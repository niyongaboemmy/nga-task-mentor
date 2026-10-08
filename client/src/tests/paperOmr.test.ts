// Paper answer sheets: layout, QR payload, bubble decisions and the marker →
// homography → fill pipeline on a synthetic "photo". The full photo set (QR
// read, tilt, shade, upside down) runs in a real browser: e2e-paper/scan.mjs.
import { describe, it, expect } from "vitest";
import { PAGE, MARKER, MARKERS, GRID, QR, CAPACITY, bubble, bubbleLabels, qrPayload, parseQr } from "../paper/layout";
import { decide, homography, apply, findMarkers, fillOf, otsu, type Gray } from "../paper/omr";

describe("sheet layout", () => {
  it("fits every bubble and the QR on A4, clear of the corner markers", () => {
    const last = bubble(CAPACITY - 1, 4);
    expect(last.x + GRID.r).toBeLessThan(PAGE.w - MARKER.inset);
    expect(last.y + GRID.r).toBeLessThan(PAGE.h - MARKER.inset - MARKER.size);
    expect(bubble(0, 0).y - GRID.r).toBeGreaterThan(QR.y + QR.size);
    expect(QR.y).toBeGreaterThan(MARKER.inset + MARKER.size); // below the top-right marker
    expect(QR.x + QR.size).toBeLessThan(PAGE.w - MARKER.inset);
  });

  it("labels true/false T/F and choices A–E", () => {
    expect(bubbleLabels({ type: "true_false", options: 2 })).toEqual(["T", "F"]);
    expect(bubbleLabels({ type: "single_choice", options: 4 })).toEqual(["A", "B", "C", "D"]);
  });

  it("round-trips the QR payload and rejects anything else", () => {
    expect(qrPayload(77, 4321, "ab12cd34ef")).toBe("TMQ1.77.4321.AB12CD34EF");
    expect(parseQr(qrPayload(77, 4321, "ab12cd34ef"))).toEqual({ quizId: 77, studentId: 4321, key: "ab12cd34ef" });
    expect(parseQr("https://example.com")).toBeNull();
    expect(parseQr("TMQ1.77.4321.short")).toBeNull();
  });
});

describe("decide", () => {
  it("reads one clear bubble, a blank and two marks", () => {
    expect(decide("single_choice", [0.05, 0.9, 0.04, 0.02])).toEqual({ selected: [1], status: "ok" });
    expect(decide("single_choice", [0.05, 0.03, 0.04, 0.02])).toEqual({ selected: [], status: "blank" });
    expect(decide("true_false", [0.8, 0.7])).toEqual({ selected: [0, 1], status: "multiple" });
  });
  it("flags a faint mark (rubbed out or light pencil) for the teacher to check", () => {
    expect(decide("single_choice", [0.9, 0.3, 0, 0]).status).toBe("unsure");
    expect(decide("single_choice", [0.1, 0.3, 0, 0])).toEqual({ selected: [], status: "unsure" });
  });
  it("allows several bubbles on multiple choice", () => {
    expect(decide("multiple_choice", [0.9, 0.0, 0.8, 0.1])).toEqual({ selected: [0, 2], status: "ok" });
  });
});

describe("homography", () => {
  it("maps the four markers exactly and lines stay lines", () => {
    const dst: Array<[number, number]> = [[120, 80], [930, 140], [980, 1300], [60, 1250]];
    const H = homography(MARKERS, dst);
    MARKERS.forEach((m, i) => {
      const [x, y] = apply(H, m[0], m[1]);
      expect(x).toBeCloseTo(dst[i][0], 6);
      expect(y).toBeCloseTo(dst[i][1], 6);
    });
  });
});

/** Draws a sheet at `s` px per mm: markers plus filled bubbles. */
function synthetic(s: number, filled: Array<[number, number]>): Gray {
  const w = Math.round(PAGE.w * s), h = Math.round(PAGE.h * s);
  const data = new Uint8ClampedArray(w * h).fill(235);
  const rect = (x0: number, y0: number, size: number) => {
    for (let y = Math.round(y0 * s); y < Math.round((y0 + size) * s); y++) for (let x = Math.round(x0 * s); x < Math.round((x0 + size) * s); x++) data[y * w + x] = 20;
  };
  for (const [cx, cy] of MARKERS) rect(cx - MARKER.size / 2, cy - MARKER.size / 2, MARKER.size);
  for (const [i, k] of filled) {
    const b = bubble(i, k);
    for (let y = Math.floor((b.y - GRID.r) * s); y <= (b.y + GRID.r) * s; y++)
      for (let x = Math.floor((b.x - GRID.r) * s); x <= (b.x + GRID.r) * s; x++)
        if (Math.hypot(x / s - b.x, y / s - b.y) < GRID.r * 0.9) data[y * w + x] = 40;
  }
  return { data, w, h };
}

describe("markers and fill", () => {
  it("finds the corner markers and tells filled bubbles from empty ones", () => {
    const g = synthetic(4, [[0, 2], [30, 0], [74, 4]]);
    const corners = findMarkers(g);
    expect(corners).not.toBeNull();
    corners!.forEach((c, i) => {
      expect(Math.abs(c[0] - MARKERS[i][0] * 4)).toBeLessThan(6);
      expect(Math.abs(c[1] - MARKERS[i][1] * 4)).toBeLessThan(6);
    });
    const H = homography(MARKERS, corners!);
    const t = otsu(g);
    const fill = (i: number, k: number) => fillOf(g, H, bubble(i, k).x, bubble(i, k).y, t);
    expect(fill(0, 2)).toBeGreaterThan(0.9);
    expect(fill(30, 0)).toBeGreaterThan(0.9);
    expect(fill(74, 4)).toBeGreaterThan(0.9);
    expect(fill(0, 1)).toBeLessThan(0.1);
    expect(fill(10, 3)).toBeLessThan(0.1);
  });

  it("gives up on a photo without the markers", () => {
    expect(findMarkers({ data: new Uint8ClampedArray(400 * 600).fill(230), w: 400, h: 600 })).toBeNull();
  });
});
