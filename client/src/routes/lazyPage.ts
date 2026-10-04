import { lazy, type ComponentType } from "react";

const RELOADED_AT = "tm.chunkReloadAt";

/**
 * A route page loaded on first visit instead of with the app: the app used to
 * ship every page in one ~6.6 MB script that a student's browser had to
 * parse before the quiz page could respond.
 *
 * After a deploy, an open tab may ask for a page file that no longer exists;
 * then the page reloads once (to the new version) instead of showing an error.
 */
// Same constraint as React's own lazy(), which is typed with ComponentType<any>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy<T>(() =>
    load().catch((error: unknown) => {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOADED_AT) || 0);
      } catch {
        /* storage blocked */
      }
      if (Date.now() - last > 30_000) {
        try {
          sessionStorage.setItem(RELOADED_AT, String(Date.now()));
        } catch {
          /* storage blocked */
        }
        window.location.reload();
        // Keep the fallback up while the page reloads.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }),
  );
}
