import { useCallback, useEffect, useRef, useState } from "react";
import { ProctoringApiService } from "../services/proctoringApi";

/**
 * Browser-side enforcement of a quiz's proctoring restrictions (TM-FIX-5).
 * Active only while proctoring is enabled for the quiz and the student is
 * answering:
 *
 *  - prevent_copy_paste: copying/cutting the quiz's own text (question,
 *    instructions) is blocked; copying inside an answer field or the code
 *    editor still works, and that text may be pasted back. Pasting anything
 *    else is blocked and logged with its length. The code editor's own
 *    paste paths are covered too (see `guardEditorPaste`).
 *  - prevent_right_click: the context menu is suppressed.
 *  - prevent_tab_switching / prevent_window_minimization: a browser can't
 *    stop either, so leaving the quiz window (tab hidden or window blurred)
 *    is detected, logged as a `tab_switch` event, reported to the live
 *    proctor and shown to the student with a running count.
 *
 * Every logged incident counts towards `max_flags_allowed`; once it is
 * exceeded and `auto_terminate_on_high_risk` is on, `onFlagLimit` fires (the
 * page submits the attempt).
 */

export interface LockdownSettings {
  enabled?: boolean;
  prevent_copy_paste?: boolean;
  prevent_right_click?: boolean;
  prevent_tab_switching?: boolean;
  prevent_window_minimization?: boolean;
  max_flags_allowed?: number | null;
  auto_terminate_on_high_risk?: boolean;
}

export type LockdownIncidentKind = "focus_lost" | "paste_blocked" | "copy_blocked";

export interface LockdownIncident {
  kind: LockdownIncidentKind;
  count: number;
  message: string;
}

// ─── Internal clipboard, shared with the code editor ─────────────────────────

const normalize = (t: string) => t.replace(/\r\n/g, "\n").trim();
const internalCopies: string[] = [];
let pasteGuard = false;
let reportBlockedPaste: ((length: number) => void) | null = null;

/** Remember text copied inside the quiz (it may be pasted back). */
export function rememberInternalCopy(text: string | null | undefined) {
  const t = normalize(text ?? "");
  if (!t) return;
  internalCopies.push(t);
  if (internalCopies.length > 50) internalCopies.shift();
}

/** True when pasting `text` is allowed right now. */
export function isPasteAllowed(text: string | null | undefined): boolean {
  if (!pasteGuard) return true;
  const t = normalize(text ?? "");
  return !t || internalCopies.includes(t);
}

/**
 * For the Monaco editor: its context-menu paste reads the clipboard API and
 * bypasses DOM paste events. Call from `onDidPaste`; returns true when the
 * paste must be undone (it has been reported).
 */
export function guardEditorPaste(pastedText: string): boolean {
  if (isPasteAllowed(pastedText)) return false;
  reportBlockedPaste?.(pastedText.length);
  return true;
}

export const isPasteGuardActive = () => pasteGuard;

// ─── The hook ────────────────────────────────────────────────────────────────

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof Element)) return false;
  if (el.closest(".monaco-editor")) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "range"].includes(type);
  }
  return (el as HTMLElement).isContentEditable;
};

const selectedText = (e: ClipboardEvent): string => {
  const set = e.clipboardData?.getData("text/plain");
  if (set) return set;
  const t = e.target;
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) {
    const { selectionStart: a, selectionEnd: b, value } = t;
    if (a !== null && b !== null && b > a) return value.slice(a, b);
  }
  return window.getSelection()?.toString() ?? "";
};

export function useQuizLockdown(opts: {
  settings: LockdownSettings | null | undefined;
  /** The student is answering (attempt started, not paused/finished). */
  active: boolean;
  /** Proctoring session token, to log events; without one nothing is logged. */
  sessionToken?: string | null;
  quizId?: number;
  /** Live-server socket (proctoring-violation). */
  socket?: { connected?: boolean; emit: (event: string, data: unknown) => void } | null;
  onFlagLimit?: () => void;
}) {
  const { settings, active, sessionToken, quizId, socket, onFlagLimit } = opts;
  const on = active && !!settings?.enabled;
  const guardPaste = on && !!settings?.prevent_copy_paste;
  const guardMenu = on && !!settings?.prevent_right_click;
  const watchFocus =
    on && (!!settings?.prevent_tab_switching || !!settings?.prevent_window_minimization);

  const [incident, setIncident] = useState<LockdownIncident | null>(null);
  const [flags, setFlags] = useState(0);
  const flagsRef = useRef(0);
  const limitFiredRef = useRef(false);
  const lastFocusLossRef = useRef(0);
  const latest = useRef({ sessionToken, quizId, socket, settings, onFlagLimit });
  latest.current = { sessionToken, quizId, socket, settings, onFlagLimit };

  const record = useCallback(
    (kind: LockdownIncidentKind, eventType: string, description: string, metadata: Record<string, unknown>) => {
      flagsRef.current += 1;
      const count = flagsRef.current;
      setFlags(count);
      const { sessionToken: token, quizId: qid, socket: sock, settings: s } = latest.current;
      const max = Number(s?.max_flags_allowed) > 0 ? Number(s?.max_flags_allowed) : null;
      const over = max !== null && count > max;
      const message =
        kind === "focus_lost"
          ? "You left the quiz window. This is recorded and your teacher can see it."
          : kind === "paste_blocked"
            ? "Pasting text from outside the quiz isn't allowed. This was recorded."
            : "Copying the quiz's text isn't allowed. This was recorded.";
      setIncident({ kind, count, message });

      const payload = { ...metadata, flags: count, max_flags_allowed: max, at: new Date().toISOString() };
      if (token) {
        ProctoringApiService.logEvent({
          session_token: token,
          event_type: eventType,
          severity: "high",
          description,
          metadata: payload,
        }).catch(() => {
          /* logged best-effort; the count still applies */
        });
        if (sock?.connected) {
          sock.emit("proctoring-violation", {
            sessionToken: token,
            quizId: qid,
            violation: {
              type: eventType,
              severity: "high",
              message: description,
              timestamp: new Date(),
              details: payload,
            },
          });
        }
      }
      if (over && s?.auto_terminate_on_high_risk && !limitFiredRef.current) {
        limitFiredRef.current = true;
        latest.current.onFlagLimit?.();
      }
    },
    [],
  );

  // Copy / cut / paste
  useEffect(() => {
    pasteGuard = guardPaste;
    reportBlockedPaste = guardPaste
      ? (length) =>
          record("paste_blocked", "auto_flag", `Blocked a paste from outside the quiz (${length} characters)`, {
            kind: "paste_blocked",
            length,
          })
      : null;
    if (!guardPaste) return;

    const onCopy = (e: ClipboardEvent) => {
      if (!isEditable(e.target)) {
        e.preventDefault();
        record("copy_blocked", "auto_flag", "Tried to copy the quiz's text", { kind: "copy_blocked" });
        return;
      }
      rememberInternalCopy(selectedText(e));
    };
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (isPasteAllowed(text)) return;
      e.preventDefault();
      e.stopPropagation();
      reportBlockedPaste?.(text.length);
    };
    // Copy in the bubble phase (after the editor put its text on the
    // clipboard); paste in the capture phase (before the editor sees it).
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    window.addEventListener("paste", onPaste, true);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      window.removeEventListener("paste", onPaste, true);
      pasteGuard = false;
      reportBlockedPaste = null;
    };
  }, [guardPaste, record]);

  // Right click
  useEffect(() => {
    if (!guardMenu) return;
    const onMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", onMenu, true);
    return () => window.removeEventListener("contextmenu", onMenu, true);
  }, [guardMenu]);

  // Leaving the window: tab hidden or window blurred (one incident when
  // both fire for the same switch).
  useEffect(() => {
    if (!watchFocus) return;
    const lost = (cause: "hidden" | "blur") => {
      const now = Date.now();
      if (now - lastFocusLossRef.current < 1500) return;
      lastFocusLossRef.current = now;
      record(
        "focus_lost",
        "tab_switch",
        cause === "hidden" ? "Left the quiz tab" : "Quiz window lost focus",
        { kind: "focus_lost", cause },
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") lost("hidden");
    };
    const onBlur = () => {
      // Focus moving into an iframe (live preview) isn't leaving the quiz.
      setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement) return;
        lost("blur");
      }, 0);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [watchFocus, record]);

  return {
    /** The latest incident, for the warning overlay (null when dismissed). */
    incident,
    dismiss: () => setIncident(null),
    /** Incidents so far this session. */
    flags,
    maxFlags:
      Number(settings?.max_flags_allowed) > 0 ? Number(settings?.max_flags_allowed) : null,
  };
}
