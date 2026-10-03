import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const updateThemePreference = vi.fn();
vi.mock("../services/authService", () => ({ updateThemePreference: (...a: unknown[]) => updateThemePreference(...a) }));

import { ThemeProvider, useTheme } from "../contexts/ThemeContext";

// A plain in-memory storage (this environment's global localStorage has no setItem).
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

const Probe = () => <span data-testid="t">{useTheme().theme}</span>;

describe("ThemeContext ← NGA desktop app", () => {
  it("applies a theme pushed by the desktop app without saving it again", () => {
    localStorage.setItem("theme", "light");
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>);
    let handled = false;
    act(() => {
      handled = !window.dispatchEvent(new CustomEvent("nga:set-theme", { detail: { theme: "dark" }, cancelable: true }));
    });
    expect(handled).toBe(true);
    expect(getByTestId("t").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(updateThemePreference).not.toHaveBeenCalled();
  });
});
