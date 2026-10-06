import { EventEmitter } from "events";
import { MONITOR_TOPIC, openSse, ProjectsBus, projectsBus, projectTopic } from "../bus";
import { publishPresence, resetPresenceTracking, sweepPresence } from "../presence";

/** A minimal Express-like response that records what was written. */
function fakeRes() {
  const res: any = new EventEmitter();
  res.chunks = [] as string[];
  res.headers = {} as Record<string, string>;
  res.writableEnded = false;
  res.status = jest.fn(() => res);
  res.setHeader = (k: string, v: string) => (res.headers[k.toLowerCase()] = v);
  res.flushHeaders = jest.fn();
  res.write = (c: string) => res.chunks.push(c);
  res.end = jest.fn(() => {
    res.writableEnded = true;
  });
  return res;
}

describe("ProjectsBus", () => {
  it("fans an event out to every subscriber of the topic only", () => {
    const bus = new ProjectsBus();
    const a = jest.fn();
    const b = jest.fn();
    const other = jest.fn();
    bus.subscribe("project:1", a);
    bus.subscribe("project:1", b);
    bus.subscribe("project:2", other);
    expect(bus.publish("project:1", "presence", { x: 1 })).toBe(2);
    expect(a).toHaveBeenCalledWith("presence", { x: 1 });
    expect(b).toHaveBeenCalledWith("presence", { x: 1 });
    expect(other).not.toHaveBeenCalled();
    expect(bus.publish("project:3", "presence", {})).toBe(0);
  });

  it("unsubscribes, and drops empty topics", () => {
    const bus = new ProjectsBus();
    const a = jest.fn();
    const off = bus.subscribe("t", a);
    expect(bus.listenerCount("t")).toBe(1);
    off();
    off(); // twice is harmless
    expect(bus.listenerCount("t")).toBe(0);
    expect(bus.listenerCount()).toBe(0);
    bus.publish("t", "e", {});
    expect(a).not.toHaveBeenCalled();
  });

  it("keeps delivering when one listener throws", () => {
    const bus = new ProjectsBus();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const good = jest.fn();
    bus.subscribe("t", () => {
      throw new Error("boom");
    });
    bus.subscribe("t", good);
    expect(bus.publish("t", "e", 1)).toBe(1);
    expect(good).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("openSse", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("sets SSE headers, writes events and heartbeats every interval", () => {
    const res = fakeRes();
    const stream = openSse({} as any, res, 25_000);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.headers["x-accel-buffering"]).toBe("no");
    expect(res.headers["cache-control"]).toMatch(/no-cache/);

    stream.send("presence", { a: 1 });
    expect(res.chunks).toContain('event: presence\ndata: {"a":1}\n\n');

    jest.advanceTimersByTime(25_000);
    expect(res.chunks.filter((c: string) => c === ": ping\n\n")).toHaveLength(1);
    jest.advanceTimersByTime(50_000);
    expect(res.chunks.filter((c: string) => c === ": ping\n\n")).toHaveLength(3);
    stream.close();
  });

  it("cleans up once on client disconnect: unsubscribes and stops the heartbeat", () => {
    const bus = new ProjectsBus();
    const res = fakeRes();
    const stream = openSse({} as any, res, 1000);
    const off = bus.subscribe("project:9", (e, d) => stream.send(e, d));
    const cleanup = jest.fn(off);
    stream.onClose(cleanup);
    expect(bus.listenerCount("project:9")).toBe(1);

    res.emit("close");
    res.emit("close");
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(stream.closed).toBe(true);
    expect(bus.listenerCount("project:9")).toBe(0);

    const before = res.chunks.length;
    jest.advanceTimersByTime(5000);
    stream.send("x", 1);
    expect(res.chunks.length).toBe(before);

    // A cleanup registered after close runs at once.
    const late = jest.fn();
    stream.onClose(late);
    expect(late).toHaveBeenCalled();
  });
});

describe("presence fan-out", () => {
  afterEach(() => {
    resetPresenceTracking();
    projectsBus.clear();
  });

  const project = { id: 77, name: "Demo", kind: "tm", language: "cpp", owner: { id: 5, name: "S", avatar_url: null } };
  const entry = (online: boolean, lastSeen: Date) => ({
    project_id: 77,
    user_id: 5,
    user_name: "S",
    device_id: "dev-1",
    app_version: "0.4.0",
    state: { open: online, file: "main.cpp" },
    last_seen_at: lastSeen.toISOString(),
    online,
  });

  it("publishes to the project stream and to the monitor with course ids", () => {
    const onProject = jest.fn();
    const onMonitor = jest.fn();
    projectsBus.subscribe(projectTopic(77), onProject);
    projectsBus.subscribe(MONITOR_TOPIC, onMonitor);
    publishPresence(project, [12, 13], entry(true, new Date()));
    expect(onProject).toHaveBeenCalledWith("presence", expect.objectContaining({ online: true, device_id: "dev-1" }));
    expect(onMonitor).toHaveBeenCalledWith(
      "presence",
      expect.objectContaining({ course_ids: [12, 13], project: expect.objectContaining({ id: 77 }) }),
    );
  });

  it("announces a device offline once it goes stale (60 s)", () => {
    const onProject = jest.fn();
    projectsBus.subscribe(projectTopic(77), onProject);
    const seen = new Date();
    publishPresence(project, [], entry(true, seen));
    onProject.mockClear();

    expect(sweepPresence(seen.getTime() + 30_000)).toBe(0);
    expect(onProject).not.toHaveBeenCalled();
    expect(sweepPresence(seen.getTime() + 61_000)).toBe(1);
    expect(onProject).toHaveBeenCalledWith("presence", expect.objectContaining({ online: false }));
    // Only once.
    expect(sweepPresence(seen.getTime() + 120_000)).toBe(0);
  });

  it("does not track a device that closed the project", () => {
    publishPresence(project, [], entry(false, new Date(0)));
    expect(sweepPresence(Date.now())).toBe(0);
  });
});
