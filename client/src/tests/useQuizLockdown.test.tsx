import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

const proctoringApi = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("../services/proctoringApi", () => ({ ProctoringApiService: proctoringApi }));

import {
  useQuizLockdown,
  guardEditorPaste,
  type LockdownSettings,
} from "../hooks/useQuizLockdown";
import LockdownWarningOverlay from "../components/Proctoring/LockdownWarningOverlay";

/** A quiz page stand-in: question text, an answer box, the hook + overlay. */
function Page({
  settings,
  active = true,
  onFlagLimit,
  socket,
}: {
  settings: LockdownSettings;
  active?: boolean;
  onFlagLimit?: () => void;
  socket?: any;
}) {
  const l = useQuizLockdown({
    settings,
    active,
    sessionToken: "sess-1",
    quizId: 9,
    socket,
    onFlagLimit,
  });
  return (
    <div>
      <p data-testid="question">What is 2 + 2?</p>
      <textarea data-testid="answer" defaultValue="my answer" />
      <LockdownWarningOverlay incident={l.incident} maxFlags={l.maxFlags} onDismiss={l.dismiss} />
    </div>
  );
}

const ALL: LockdownSettings = {
  enabled: true,
  prevent_copy_paste: true,
  prevent_right_click: true,
  prevent_tab_switching: true,
  prevent_window_minimization: true,
  max_flags_allowed: 2,
  auto_terminate_on_high_risk: true,
};

/** Dispatch a clipboard event (jsdom has no ClipboardEvent constructor). */
function clip(target: EventTarget, type: "copy" | "cut" | "paste", text: string) {
  const store: Record<string, string> = { "text/plain": text };
  const e = new Event(type, { bubbles: true, cancelable: true }) as any;
  e.clipboardData = {
    getData: (t: string) => store[t] ?? "",
    setData: (t: string, v: string) => (store[t] = v),
  };
  target.dispatchEvent(e);
  return e as Event;
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  proctoringApi.logEvent.mockResolvedValue({ success: true });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  setHidden(false);
});

describe("useQuizLockdown (TM-FIX-5)", () => {
  it("prevent_right_click: the context menu is suppressed", () => {
    render(<Page settings={ALL} />);
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    screen.getByTestId("question").dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("prevent_copy_paste: an outside paste is blocked and logged with its length", () => {
    render(<Page settings={ALL} />);
    let e!: Event;
    act(() => {
      e = clip(screen.getByTestId("answer"), "paste", "from ChatGPT");
    });
    expect(e.defaultPrevented).toBe(true);
    expect(proctoringApi.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        session_token: "sess-1",
        event_type: "auto_flag",
        metadata: expect.objectContaining({ kind: "paste_blocked", length: 12 }),
      }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/Pasting text from outside/);
  });

  it("prevent_copy_paste: text copied inside an answer may be pasted back", () => {
    render(<Page settings={ALL} />);
    const answer = screen.getByTestId("answer");
    expect(clip(answer, "copy", "my answer").defaultPrevented).toBe(false);
    expect(clip(answer, "paste", "my answer").defaultPrevented).toBe(false);
    expect(proctoringApi.logEvent).not.toHaveBeenCalled();
    // the code editor's own paste path follows the same rule
    expect(guardEditorPaste("my answer")).toBe(false);
    expect(guardEditorPaste("something else")).toBe(true);
  });

  it("prevent_copy_paste: copying the question text is blocked", () => {
    render(<Page settings={ALL} />);
    expect(clip(screen.getByTestId("question"), "copy", "").defaultPrevented).toBe(true);
    expect(proctoringApi.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ kind: "copy_blocked" }) }),
    );
  });

  it("leaving the tab is logged as tab_switch, reported live, and counted on screen", () => {
    const socket = { connected: true, emit: vi.fn() };
    render(<Page settings={ALL} socket={socket} />);
    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(proctoringApi.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "tab_switch", severity: "high" }),
    );
    expect(socket.emit).toHaveBeenCalledWith(
      "proctoring-violation",
      expect.objectContaining({ sessionToken: "sess-1", quizId: 9 }),
    );
    expect(screen.getByTestId("lockdown-count")).toHaveTextContent("1 of 2 allowed");
    // Wording: monitored, not prevented.
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/recorded/);
  });

  it("a blur and a hidden tab for the same switch count once", () => {
    render(<Page settings={ALL} />);
    act(() => {
      window.dispatchEvent(new Event("blur"));
      vi.advanceTimersByTime(1);
      setHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(proctoringApi.logEvent).toHaveBeenCalledTimes(1);
  });

  it("over max_flags_allowed with auto_terminate_on_high_risk, the attempt is ended", () => {
    const onFlagLimit = vi.fn();
    render(<Page settings={ALL} onFlagLimit={onFlagLimit} />);
    for (let i = 0; i < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(2000);
        clip(screen.getByTestId("answer"), "paste", `outside ${i}`);
      });
    }
    expect(onFlagLimit).toHaveBeenCalledTimes(1);
  });

  it("does nothing when proctoring is off or the student isn't answering", () => {
    const { unmount } = render(<Page settings={{ ...ALL, enabled: false }} />);
    expect(clip(screen.getByTestId("answer"), "paste", "x").defaultPrevented).toBe(false);
    unmount();
    render(<Page settings={ALL} active={false} />);
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    screen.getByTestId("question").dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(proctoringApi.logEvent).not.toHaveBeenCalled();
  });

  it("each setting only does its own thing", () => {
    render(<Page settings={{ enabled: true, prevent_right_click: true }} />);
    expect(clip(screen.getByTestId("answer"), "paste", "outside").defaultPrevented).toBe(false);
    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(proctoringApi.logEvent).not.toHaveBeenCalled();
    fireEvent.contextMenu(screen.getByTestId("question"));
  });
});
