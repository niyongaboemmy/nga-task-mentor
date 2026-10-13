/**
 * sqlite3's `-header -box` output, so a query run in the browser prints what
 * the server prints (the SQL starters' tests expect this layout).
 */
export interface ResultSet {
  columns: string[];
  values: unknown[][];
}

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Uint8Array) return Array.from(v, (b) => String.fromCharCode(b)).join("");
  return String(v);
};

export function formatBox({ columns, values }: ResultSet): string {
  const rows = values.map((r) => r.map(cell));
  const width = columns.map((c, i) => Math.max([...c].length, ...rows.map((r) => [...(r[i] ?? "")].length)));
  const line = (l: string, m: string, r: string) => l + width.map((w) => "─".repeat(w + 2)).join(m) + r + "\n";
  const row = (cells: string[]) => "│" + cells.map((c, i) => ` ${c}${" ".repeat(width[i]! - [...c].length)} `).join("│") + "│\n";
  return line("┌", "┬", "┐") + row(columns) + line("├", "┼", "┤") + rows.map(row).join("") + line("└", "┴", "┘");
}
