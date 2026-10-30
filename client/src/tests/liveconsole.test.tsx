import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import LiveConsole from "../vendor/nga-liveconsole/LiveConsole";

/**
 * nga-liveconsole (nga_central_mis/packages/liveconsole): the vendored copy is
 * the package's, untouched, and renders with the grading page's own colours.
 */

const src = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("nga-liveconsole", () => {
  for (const file of ["index.ts", "useLiveRun.ts", "LiveConsole.tsx"]) {
    it(`vendored ${file} matches its provenance hash (re-sync with nga_central_mis/packages/liveconsole/sync.mjs)`, () => {
      const [first, , shaLine, ...rest] = src(`vendor/nga-liveconsole/${file}`).split("\n");
      expect(first).toBe(`// VENDORED from nga_central_mis/packages/liveconsole/src/${file} -- do not edit.`);
      expect(shaLine).toBe(`// sha256:${crypto.createHash("sha256").update(rest.join("\n")).digest("hex")}`);
    });
  }

  it("takes the page's colours, texts and test ids, and asks for input after a prompt", () => {
    vi.useFakeTimers();
    const onLine = vi.fn();
    render(
      <LiveConsole
        chunks={[{ kind: "out", text: "Name: " }]}
        running
        stage="run"
        lastOutputAt={Date.now()}
        onLine={onLine}
        onEof={vi.fn()}
        onInterrupt={vi.fn()}
        theme={{ err: "text-rose-300", out: "text-slate-100" }}
        texts={{ waiting: "The program is waiting for input" }}
        testIdPrefix="run"
      />,
    );
    act(() => void vi.advanceTimersByTime(300));
    expect(screen.getByTestId("run-waiting")).toHaveTextContent("The program is waiting for input");
    expect(document.querySelector('[data-kind="out"]')?.className).toBe("text-slate-100");
    fireEvent.change(screen.getByTestId("run-stdin"), { target: { value: "Ama" } });
    fireEvent.keyDown(screen.getByTestId("run-stdin"), { key: "Enter" });
    expect(onLine).toHaveBeenCalledWith("Ama");
  });
});
