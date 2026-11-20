/**
 * Pure rules behind manual marks entry (ManualScoreEntry): what a typed or
 * pasted cell means, which rows changed since the last save, and the local
 * draft that survives a closed tab or a dropped connection.
 *
 * A row is a score, or a status: absent (counts as 0 on the report card) or
 * exempt (left out). The server stores both (manual_assessment_scores.status).
 */

export type MarkStatus = "scored" | "absent" | "exempt";

export interface MarkEntry {
  /** The typed score ("" = nothing yet); ignored unless status is "scored". */
  score: string;
  status: MarkStatus;
}

export type MarkBook = Record<number, MarkEntry>;

export const EMPTY: MarkEntry = { score: "", status: "scored" };

/** A row counts as recorded when it has a score or a status. */
export const isRecorded = (e: MarkEntry | undefined) => !!e && (e.status !== "scored" || e.score.trim() !== "");

/** "18", "18.5", "18,5" -> 18.5 (clamped to 0..max); "a"/"abs"/"absent" -> absent; "e"/"ex"/"exempt" -> exempt; else null. */
export function parseCell(raw: string, max: number): MarkEntry | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (["a", "ab", "abs", "absent"].includes(t)) return { score: "", status: "absent" };
  if (["e", "ex", "exe", "exempt", "exempted"].includes(t)) return { score: "", status: "exempt" };
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const v = Math.min(Math.max(n, 0), max);
  return { score: String(Number(v.toFixed(2))), status: "scored" };
}

/**
 * A pasted block (a column copied from a spreadsheet, one value per line;
 * with tabs the last cell of each line is taken, so "Name<TAB>Mark" rows
 * work too) as entries, in order. Unreadable cells come back as null so the
 * rows keep lining up.
 */
export function parsePaste(text: string, max: number): Array<MarkEntry | null> {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.map((line) => {
    const cells = line.split("\t").map((c) => c.trim()).filter(Boolean);
    return parseCell(cells[cells.length - 1] ?? "", max);
  });
}

const same = (a: MarkEntry | undefined, b: MarkEntry | undefined) => {
  const x = a ?? EMPTY;
  const y = b ?? EMPTY;
  if (x.status !== y.status) return false;
  if (x.status !== "scored") return true;
  const nx = x.score.trim() === "" ? null : Number(x.score);
  const ny = y.score.trim() === "" ? null : Number(y.score);
  return nx === ny;
};

/** Student ids whose entry differs from what was last saved. */
export function changedIds(book: MarkBook, saved: MarkBook): number[] {
  const ids = new Set([...Object.keys(book), ...Object.keys(saved)].map(Number));
  return [...ids].filter((id) => !same(book[id], saved[id]));
}

/**
 * What a save sends: changed rows with a score or a status. A saved score
 * that was emptied can't be deleted (the server keeps marks), so it's
 * reported as `kept` instead of being sent.
 */
export function savePayload(book: MarkBook, saved: MarkBook, max: number) {
  const scores: Array<{ student_id: number; score: number; status: MarkStatus }> = [];
  const kept: number[] = [];
  const invalid: number[] = [];
  for (const id of changedIds(book, saved)) {
    const e = book[id] ?? EMPTY;
    if (e.status !== "scored") {
      scores.push({ student_id: id, score: 0, status: e.status });
      continue;
    }
    if (e.score.trim() === "") {
      if (isRecorded(saved[id])) kept.push(id);
      continue;
    }
    const n = Number(e.score);
    if (!Number.isFinite(n) || n < 0 || n > max) {
      invalid.push(id);
      continue;
    }
    scores.push({ student_id: id, score: n, status: "scored" });
  }
  return { scores, kept, invalid };
}

// ─── Local draft ─────────────────────────────────────────────────────────────

const draftKey = (assessmentId: number) => `tm:marks-draft:${assessmentId}`;

export interface MarksDraft {
  at: number;
  entries: MarkBook;
}

/** The unsaved rows of an assessment, kept in this browser until saved or discarded. */
export function readDraft(assessmentId: number): MarksDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(assessmentId));
    if (!raw) return null;
    const d = JSON.parse(raw) as MarksDraft;
    return d && typeof d.at === "number" && d.entries && Object.keys(d.entries).length ? d : null;
  } catch {
    return null;
  }
}

export function writeDraft(assessmentId: number, entries: MarkBook): void {
  try {
    if (Object.keys(entries).length === 0) window.localStorage.removeItem(draftKey(assessmentId));
    else window.localStorage.setItem(draftKey(assessmentId), JSON.stringify({ at: Date.now(), entries }));
  } catch {
    // Private mode / storage full: the draft is a convenience only.
  }
}

export const clearDraft = (assessmentId: number) => writeDraft(assessmentId, {});
