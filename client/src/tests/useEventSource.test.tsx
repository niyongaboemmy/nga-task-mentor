import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { backoffDelay, useEventSource, type SseHandler } from "../hooks/useEventSource";
import { LiveIndicator } from "../components/Projects/ProjectBadges";

/** A controllable stand-in for the browser's EventSource. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  url: string;
  withCredentials: boolean;
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  closed = false;
  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = !!init?.withCredentials;
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  emit(name: string, data: unknown) {
    const ev = new MessageEvent(name, { data: typeof data === "string" ? data : JSON.stringify(data) });
    if (name === "message") this.onmessage?.(ev);
    else this.listeners.get(name)?.forEach((fn) => fn(ev));
  }
  /** The server ended the stream: the browser won't retry. */
  failClosed() {
    this.readyState = 2;
    this.onerror?.(new Event("error"));
  }
  /** A network drop: the browser retries by itself. */
  failRetrying() {
    this.readyState = 0;
    this.onerror?.(new Event("error"));
  }
  static last() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }
}

const Probe: React.FC<{ url: string | null; handlers: Record<string, SseHandler> }> = ({ url, handlers }) => {
  const { status, attempts, reconnect } = useEventSource(url, handlers, { initialBackoffMs: 1000, maxBackoffMs: 8000 });
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="attempts">{attempts}</span>
      <LiveIndicator status={status} onRetry={reconnect} />
    </div>
  );
};

describe("useEventSource (live panel SSE)", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects with credentials, goes live and dispatches named and typed events", () => {
    const presence = vi.fn();
    const revision = vi.fn();
    render(<Probe url="http://api/x/live" handlers={{ presence, revision }} />);
    expect(screen.getByTestId("status")).toHaveTextContent("connecting");
    const es = FakeEventSource.last();
    expect(es.url).toBe("http://api/x/live");
    expect(es.withCredentials).toBe(true);

    act(() => es.open());
    expect(screen.getByTestId("status")).toHaveTextContent("live");
    expect(screen.getByTestId("live-indicator")).toHaveTextContent("Live");

    act(() => es.emit("presence", { user_id: 1, state: { open: true } }));
    expect(presence).toHaveBeenCalledWith({ user_id: 1, state: { open: true } }, expect.any(MessageEvent));

    // An unnamed message routed by its `type`.
    act(() => es.emit("message", { type: "revision", data: { id: 9, number: 4 } }));
    expect(revision).toHaveBeenCalledWith({ id: 9, number: 4 }, expect.any(MessageEvent));
  });

  it("backs off and reopens when the server closes the stream, then shows live again", () => {
    render(<Probe url="http://api/x/live" handlers={{ presence: vi.fn() }} />);
    act(() => FakeEventSource.last().open());

    act(() => FakeEventSource.last().failClosed());
    expect(screen.getByTestId("status")).toHaveTextContent("reconnecting");
    expect(screen.getByTestId("live-indicator")).toHaveTextContent("Reconnecting…");
    expect(screen.getByTestId("attempts")).toHaveTextContent("1");
    expect(FakeEventSource.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(999));
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[0].closed).toBe(true);

    // Second failure waits twice as long.
    act(() => FakeEventSource.last().failClosed());
    expect(screen.getByTestId("attempts")).toHaveTextContent("2");
    act(() => vi.advanceTimersByTime(1999));
    expect(FakeEventSource.instances).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeEventSource.instances).toHaveLength(3);

    act(() => FakeEventSource.last().open());
    expect(screen.getByTestId("status")).toHaveTextContent("live");
    expect(screen.getByTestId("attempts")).toHaveTextContent("0");
  });

  it("shows reconnecting while the browser retries a dropped connection itself", () => {
    render(<Probe url="http://api/x/live" handlers={{}} />);
    act(() => FakeEventSource.last().open());
    act(() => FakeEventSource.last().failRetrying());
    expect(screen.getByTestId("status")).toHaveTextContent("reconnecting");
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => FakeEventSource.last().open());
    expect(screen.getByTestId("status")).toHaveTextContent("live");
  });

  it("'Retry now' reconnects immediately", () => {
    render(<Probe url="http://api/x/live" handlers={{}} />);
    act(() => FakeEventSource.last().failClosed());
    act(() => screen.getByRole("button", { name: "Retry now" }).click());
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it("closes the stream on unmount and stays idle without a URL", () => {
    const { unmount } = render(<Probe url="http://api/x/live" handlers={{}} />);
    const es = FakeEventSource.last();
    unmount();
    expect(es.closed).toBe(true);

    render(<Probe url={null} handlers={{}} />);
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("caps the backoff", () => {
    expect([1, 2, 3, 4, 10].map((n) => backoffDelay(n, 1000, 8000))).toEqual([1000, 2000, 4000, 8000, 8000]);
  });
});
