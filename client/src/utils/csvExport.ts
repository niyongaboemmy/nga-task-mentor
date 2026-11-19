// ─── CSV export (AN-30) ───────────────────────────────────────────────────────
// One writer for every report download, so each export is safe to open in
// Excel / LibreOffice / Google Sheets:
//   • every cell is quoted and inner quotes are doubled (RFC 4180);
//   • a text cell starting with = + - @ TAB or CR gets a leading apostrophe,
//     so a student name like "=HYPERLINK(...)" is shown, never executed
//     (spreadsheet formula injection). Real numbers (type number) are written
//     as they are, so a negative change like -4.5 stays a number;
//   • the file starts with a UTF-8 BOM, or Excel mangles accented names.

export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell, quoted and neutralised. null / undefined / NaN become an empty cell. */
export const csvCell = (value: CsvCell): string => {
  if (value === null || value === undefined) return '""';
  if (typeof value === "number") {
    return Number.isFinite(value) ? `"${value}"` : '""';
  }
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
};

/** Rows → CSV text (CRLF line endings, which every spreadsheet reads). */
export const toCsv = (rows: CsvCell[][]): string =>
  rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

/** Build the CSV and hand it to the browser as a download. */
export const downloadCsv = (filename: string, rows: CsvCell[][]): void => {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** A filename-safe slug: "S4 MPC / Term 1" → "s4-mpc-term-1". */
export const csvSlug = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "export";
