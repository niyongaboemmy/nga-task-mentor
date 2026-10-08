/**
 * Paper answer sheet geometry, in millimetres on A4 portrait (210 × 297).
 * The print page draws from it and the scanner reads with it, so the two can
 * never disagree. Everything is measured from the page's top-left corner.
 *
 *   ■ (four corner markers: filled squares the scanner finds first)
 *   header + QR code (quiz, student, sheet key)
 *   three columns of numbered rows, bubbles A–E (or T/F)
 */
export const PAGE = { w: 210, h: 297 };
export const MARKER = { size: 8, inset: 10 };
/** Marker centres, clockwise from top-left: TL, TR, BR, BL. */
export const MARKERS: Array<[number, number]> = [
  [MARKER.inset + MARKER.size / 2, MARKER.inset + MARKER.size / 2],
  [PAGE.w - MARKER.inset - MARKER.size / 2, MARKER.inset + MARKER.size / 2],
  [PAGE.w - MARKER.inset - MARKER.size / 2, PAGE.h - MARKER.inset - MARKER.size / 2],
  [MARKER.inset + MARKER.size / 2, PAGE.h - MARKER.inset - MARKER.size / 2],
];
// Upper-case payload → QR alphanumeric mode, version 1 (21×21) at level L: ~1.5 mm per square.
export const QR = { x: 162, y: 21, size: 32 };
export const GRID = { top: 62, rowH: 8.4, rows: 25, columns: 3, colW: 64, left: 16, labelW: 11, firstBubble: 15, bubbleGap: 9.5, r: 2.8 };
export const CAPACITY = GRID.rows * GRID.columns;
export const LETTERS = ["A", "B", "C", "D", "E"];

export interface SheetQuestionLayout {
  id: number;
  number: number;
  type: "single_choice" | "multiple_choice" | "true_false";
  options: number;
}

/** Row position of the i-th printed question (0-based). */
export function cell(i: number): { x: number; y: number } {
  const col = Math.floor(i / GRID.rows);
  const row = i % GRID.rows;
  return { x: GRID.left + col * GRID.colW, y: GRID.top + row * GRID.rowH };
}

/** Centre of bubble k of the i-th printed question. */
export function bubble(i: number, k: number): { x: number; y: number } {
  const c = cell(i);
  return { x: c.x + GRID.firstBubble + k * GRID.bubbleGap, y: c.y + GRID.rowH / 2 };
}

export const bubbleLabels = (q: Pick<SheetQuestionLayout, "type" | "options">) =>
  q.type === "true_false" ? ["T", "F"] : LETTERS.slice(0, q.options);

/** The QR payload: TMQ1.<quizId>.<studentId>.<SHEETKEY> (upper case: smaller, coarser code). */
export const qrPayload = (quizId: number, studentId: number, key: string) => `TMQ1.${quizId}.${studentId}.${key.toUpperCase()}`;
export function parseQr(text: string): { quizId: number; studentId: number; key: string } | null {
  const m = /^TMQ1\.(\d+)\.(\d+)\.([0-9a-f]{10})$/i.exec(String(text || "").trim());
  return m ? { quizId: Number(m[1]), studentId: Number(m[2]), key: m[3].toLowerCase() } : null;
}
