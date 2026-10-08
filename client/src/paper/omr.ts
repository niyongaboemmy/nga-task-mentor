/**
 * Reading a photographed or scanned answer sheet (layout.ts), in the browser.
 *
 * 1. Grey levels and an Otsu threshold (dark ink vs paper).
 * 2. The four corner markers: filled, square-ish dark blobs, the ones nearest
 *    each corner of the photo.
 * 3. A perspective transform (homography) from sheet millimetres to photo
 *    pixels, so a tilted or skewed photo reads like a flat scan.
 * 4. The QR code (quiz, student, sheet key), read from the straightened sheet;
 *    if it doesn't read, the sheet is tried upside down.
 * 5. Each bubble's fill: the share of dark pixels inside it. A question is
 *    "ok" when the choice is clear; "blank", "multiple" (two bubbles on a
 *    one-answer question) and "unsure" (a faint or half-erased mark) go to the
 *    teacher.
 *
 * Pure functions over plain arrays; no DOM, so they're unit-tested.
 */
import jsQR from "jsqr";
import { CAPACITY, GRID, MARKERS, QR, bubble, parseQr, type SheetQuestionLayout } from "./layout";

export interface Gray {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}
type Pt = [number, number];
export type Matrix = number[]; // 3×3 row-major

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Gray {
  const data = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) data[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  return { data, w, h };
}

/** Otsu's threshold over a grey image. */
export function otsu(g: Gray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < g.data.length; i++) hist[g.data[i]]++;
  const total = g.data.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, bestT = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return bestT;
}

interface Blob { cx: number; cy: number; area: number; w: number; h: number }

/**
 * Dark connected blobs (4-connectivity) on a downscaled copy, for speed. A
 * pixel is dark when it is clearly darker than its neighbourhood (and than the
 * global ink level), so a shadow across the photo doesn't swallow the markers.
 */
function blobs(g: Gray, threshold: number, step: number): Blob[] {
  const w = Math.floor(g.w / step), h = Math.floor(g.h / step);
  const small = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) small[y * w + x] = g.data[y * step * g.w + x * step];
  // Integral image for local means.
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += small[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(4, Math.round(Math.max(w, h) / 16));
  const dark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const mean = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((y1 - y0) * (x1 - x0));
      const v = small[y * w + x];
      dark[y * w + x] = v < mean * 0.7 && v < Math.max(threshold, mean * 0.55) + 40 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(w * h);
  const out: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < dark.length; start++) {
    if (!dark[start] || seen[start]) continue;
    let area = 0, sx = 0, sy = 0, minX = w, maxX = 0, minY = h, maxY = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w, y = (p - x) / w;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      const n = [p - 1, p + 1, p - w, p + w];
      if (x === 0) n[0] = -1; if (x === w - 1) n[1] = -1;
      for (const q of n) if (q >= 0 && q < dark.length && dark[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
    }
    out.push({ cx: (sx / area) * step, cy: (sy / area) * step, area: area * step * step, w: (maxX - minX + 1) * step, h: (maxY - minY + 1) * step });
  }
  return out;
}

/** The four corner markers as photo points TL, TR, BR, BL, or null. */
export function findMarkers(g: Gray, threshold = otsu(g)): Pt[] | null {
  const step = Math.max(1, Math.round(Math.max(g.w, g.h) / 900));
  const img = g.w * g.h;
  const cands = blobs(g, threshold, step).filter((b) => {
    const aspect = b.w / b.h;
    const fill = b.area / (b.w * b.h);
    return b.area > img * 0.00015 && b.area < img * 0.02 && aspect > 0.6 && aspect < 1.6 && fill > 0.72;
  });
  if (cands.length < 4) return null;
  // Markers are the biggest solid squares: drop small blobs (filled bubbles, dots).
  const sizes = cands.map((c) => c.area).sort((a, b) => b - a);
  const floor = sizes[Math.min(3, sizes.length - 1)] * 0.55;
  const big = cands.filter((c) => c.area >= floor);
  const corners: Pt[] = [[0, 0], [g.w, 0], [g.w, g.h], [0, g.h]];
  const used = new Set<Blob>();
  const picked: Pt[] = [];
  for (const [x, y] of corners) {
    let best: Blob | null = null, bestD = Infinity;
    for (const c of big) {
      if (used.has(c)) continue;
      const d = (c.cx - x) ** 2 + (c.cy - y) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best) return null;
    used.add(best);
    picked.push([best.cx, best.cy]);
  }
  // A sane quadrilateral covering a good part of the photo.
  const area = Math.abs(picked.reduce((s, [x, y], i) => { const [x2, y2] = picked[(i + 1) % 4]; return s + x * y2 - x2 * y; }, 0)) / 2;
  return area > img * 0.12 ? picked : null;
}

/** Homography mapping src[i] → dst[i] (4 points), solved by Gaussian elimination. */
export function homography(src: Pt[], dst: Pt[]): Matrix {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-12;
    for (let k = c; k < 9; k++) A[c][k] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f) for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [A[0][8], A[1][8], A[2][8], A[3][8], A[4][8], A[5][8], A[6][8], A[7][8], 1];
}

export function apply(H: Matrix, x: number, y: number): Pt {
  const d = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
}

function sample(g: Gray, x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= g.w - 1 || yi >= g.h - 1) return 255;
  const fx = x - xi, fy = y - yi, i = yi * g.w + xi;
  return g.data[i] * (1 - fx) * (1 - fy) + g.data[i + 1] * fx * (1 - fy) + g.data[i + g.w] * (1 - fx) * fy + g.data[i + g.w + 1] * fx * fy;
}

/**
 * Share of dark samples inside a bubble (sheet mm → photo via H). "Dark" is
 * judged against the paper just around this bubble (its brighter samples),
 * so shade on one side of the photo doesn't fill the bubbles there.
 */
export function fillOf(g: Gray, H: Matrix, cx: number, cy: number, threshold: number): number {
  const ring: number[] = [];
  const RR = GRID.r * 1.45;
  for (let s = 0; s < 24; s++) {
    const a = (2 * Math.PI * s) / 24;
    const [px, py] = apply(H, cx + RR * Math.cos(a), cy + RR * Math.sin(a));
    ring.push(sample(g, px, py));
  }
  ring.sort((a, b) => a - b);
  const paper = ring[Math.floor(ring.length * 0.75)];
  const cut = Math.min(paper * 0.62, Math.max(threshold, paper * 0.45));
  let dark = 0, n = 0;
  const R = GRID.r * 0.62; // inside the printed ring
  for (let ri = 0; ri <= 4; ri++) {
    const r = (R * ri) / 4;
    const steps = ri === 0 ? 1 : 8 * ri;
    for (let s = 0; s < steps; s++) {
      const a = (2 * Math.PI * s) / steps;
      const [px, py] = apply(H, cx + r * Math.cos(a), cy + r * Math.sin(a));
      if (sample(g, px, py) < cut) dark++;
      n++;
    }
  }
  return dark / n;
}

export const MARK = 0.5;
export const FAINT = 0.22;
export type QuestionStatus = "ok" | "blank" | "multiple" | "unsure";

/** What the teacher meant, from the bubbles' fill (pure, unit-tested). */
export function decide(type: SheetQuestionLayout["type"], fills: number[]): { selected: number[]; status: QuestionStatus } {
  const marked = fills.map((f, i) => (f >= MARK ? i : -1)).filter((i) => i >= 0);
  const faint = fills.some((f) => f >= FAINT && f < MARK);
  if (type === "multiple_choice") {
    return { selected: marked, status: faint ? "unsure" : marked.length ? "ok" : "blank" };
  }
  if (marked.length === 1) return { selected: marked, status: faint ? "unsure" : "ok" };
  if (marked.length > 1) return { selected: marked, status: "multiple" };
  return { selected: [], status: faint ? "unsure" : "blank" };
}

/**
 * Straightened QR region as RGBA, for jsQR. `clean`: average a few nearby
 * samples (grainy photos in dim rooms) and stretch the contrast to full range.
 */
function qrImage(g: Gray, H: Matrix, clean: boolean, pxPerMm = 7): { data: Uint8ClampedArray; w: number; h: number } {
  const margin = 3;
  const size = Math.round((QR.size + 2 * margin) * pxPerMm);
  const vals = new Float32Array(size * size);
  // Source pixels per sheet mm, to size the smoothing to the photo.
  const [ax, ay] = apply(H, QR.x, QR.y);
  const [bx, by] = apply(H, QR.x + 1, QR.y);
  const pxPerSheetMm = Math.hypot(bx - ax, by - ay);
  const d = clean ? Math.max(0.5, pxPerSheetMm * 0.18) : 0;
  let lo = 255, hi = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [px, py] = apply(H, QR.x - margin + x / pxPerMm, QR.y - margin + y / pxPerMm);
      const v = clean
        ? (sample(g, px, py) * 2 + sample(g, px - d, py) + sample(g, px + d, py) + sample(g, px, py - d) + sample(g, px, py + d)) / 6
        : sample(g, px, py);
      vals[y * size + x] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const span = clean ? Math.max(1, hi - lo) : 255;
  const base = clean ? lo : 0;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < vals.length; i++) {
    const v = ((vals[i] - base) * 255) / span;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { data, w: size, h: size };
}

function readQr(g: Gray, H: Matrix) {
  for (const [clean, pxPerMm] of [[false, 7], [true, 7], [true, 5], [false, 9]] as Array<[boolean, number]>) {
    const qr = qrImage(g, H, clean, pxPerMm);
    const code = jsQR(qr.data, qr.w, qr.h, { inversionAttempts: "dontInvert" });
    const payload = code ? parseQr(code.data) : null;
    if (payload) return payload;
  }
  return null;
}

export interface ScanResult {
  ok: boolean;
  error?: string;
  quizId?: number;
  studentId?: number;
  key?: string;
  /** Per printed question: what was read and how sure. */
  answers?: Array<{ id: number; number: number; selected: number[]; status: QuestionStatus; fills: number[] }>;
}

/** Reads one sheet. `questions` = the quiz's sheet layout (GET /paper-sheet). */
export function scanSheet(g: Gray, questions: SheetQuestionLayout[]): ScanResult {
  if (questions.length > CAPACITY) return { ok: false, error: "Too many questions for one sheet" };
  const threshold = otsu(g);
  const corners = findMarkers(g, threshold);
  if (!corners) return { ok: false, error: "Couldn't find the four corner squares. Photograph the whole sheet, flat and well lit." };
  // Try upright, then upside down (corners rotated by two).
  for (const turn of [0, 2]) {
    const photo = [0, 1, 2, 3].map((i) => corners[(i + turn) % 4]);
    const H = homography(MARKERS, photo);
    const payload = readQr(g, H);
    if (!payload) continue;
    const answers = questions.map((q, i) => {
      const fills = Array.from({ length: q.type === "true_false" ? 2 : q.options }, (_, k) => {
        const c = bubble(i, k);
        return fillOf(g, H, c.x, c.y, threshold);
      });
      return { id: q.id, number: q.number, ...decide(q.type, fills), fills };
    });
    return { ok: true, ...payload, answers };
  }
  return { ok: false, error: "Couldn't read the QR code. Keep the sheet's top-right corner sharp and uncovered." };
}
