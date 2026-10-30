/**
 * The vendored nga-webrun (src/vendor/nga-webrun) is one file for browsers and
 * servers: its browser half (listenToRun) names `window`, which the server never
 * calls. Declared here, as narrowly as that code uses it, so the server compiles
 * the copy unedited.
 */
declare const window: {
  addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
};
