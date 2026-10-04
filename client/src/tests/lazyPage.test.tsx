// Pages load on first visit; after a deploy an old tab may ask for a page file
// that is gone: reload once to the new version, never loop.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { lazyPage } from "../routes/lazyPage";

describe("lazyPage", () => {
  const reload = vi.fn();
  beforeEach(() => {
    reload.mockReset();
    sessionStorage.clear();
    Object.defineProperty(window, "location", { value: { ...window.location, reload }, writable: true });
  });

  it("renders the page once its code has loaded", async () => {
    const Page = lazyPage(() => Promise.resolve({ default: () => <h1>Quiz</h1> }));
    render(<Suspense fallback="loading">{<Page />}</Suspense>);
    expect(await screen.findByText("Quiz")).toBeInTheDocument();
  });

  it("reloads once when the page file is gone after a deploy", async () => {
    const gone = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module"));
    const Page = lazyPage(gone);
    render(<Suspense fallback="loading">{<Page />}</Suspense>);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("doesn't reload again right after a reload (shows the error instead)", async () => {
    sessionStorage.setItem("tm.chunkReloadAt", String(Date.now()));
    const Page = lazyPage(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module")));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    class Boundary extends (await import("react")).Component<{ children: React.ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        return this.state.failed ? <p>could not load</p> : this.props.children;
      }
    }
    render(
      <Boundary>
        <Suspense fallback="loading">
          <Page />
        </Suspense>
      </Boundary>,
    );
    expect(await screen.findByText("could not load")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
