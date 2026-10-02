import React, { useEffect, useSyncExternalStore } from "react";

/**
 * Focus mode: while a page that needs the student's full attention is open
 * (taking a quiz), app-level floating extras — the install card and pill,
 * future banners or widgets — step aside so nothing covers the page's own
 * controls. Pages turn it on with `useFocusMode()`; floating elements either
 * sit inside `<HideInFocusMode>` or carry `data-hide-in-focus`, which a rule
 * in index.css hides while `<html data-focus-mode>` is set.
 *
 * It is reference-counted so overlapping pages can't switch it off for each
 * other, and the elements stay mounted (only hidden), so nothing re-opens or
 * re-asks once focus mode ends.
 */

let holders = 0;
const listeners = new Set<() => void>();

function apply() {
  if (typeof document !== "undefined") {
    document.documentElement.toggleAttribute("data-focus-mode", holders > 0);
  }
  listeners.forEach((l) => l());
}

/** Turn focus mode on; call the returned function (once) to release it. */
export function enterFocusMode(): () => void {
  holders += 1;
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    apply();
  };
}

export const isFocusModeActive = () => holders > 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hold focus mode while the calling component is mounted (and `active`). */
export function useFocusMode(active = true) {
  useEffect(() => (active ? enterFocusMode() : undefined), [active]);
}

export function useFocusModeActive(): boolean {
  return useSyncExternalStore(subscribe, isFocusModeActive, () => false);
}

/** Keeps its children mounted but hidden while focus mode is on. */
export const HideInFocusMode: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const active = useFocusModeActive();
  return React.createElement(
    "div",
    { "data-hide-in-focus": "", style: { display: active ? "none" : "contents" } },
    children,
  );
};
