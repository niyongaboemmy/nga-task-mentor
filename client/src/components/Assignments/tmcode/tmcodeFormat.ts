/** "Due in 2 days 3 h" / "Late by 5 h", with a tone; null without a due date. */
export function dueCountdown(due: string | null | undefined, now = Date.now()): { text: string; tone: string; late: boolean } | null {
  if (!due) return null;
  const ms = new Date(due).getTime() - now;
  if (!Number.isFinite(ms)) return null;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const span =
    days > 0 ? `${days} day${days > 1 ? "s" : ""}${hours ? ` ${hours} h` : ""}` : hours > 0 ? `${hours} h${minutes ? ` ${minutes} min` : ""}` : `${Math.max(1, minutes)} min`;
  if (ms < 0) return { text: `Late by ${span}`, tone: "text-rose-600 dark:text-rose-400", late: true };
  return {
    text: `Due in ${span}`,
    tone: days < 1 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300",
    late: false,
  };
}

/**
 * The one cutoff (UX review S6), from the server's submission window: late
 * work is accepted until the teacher closes the assignment.
 */
export function cutoffText(
  a: { accepts_submissions?: boolean; accepts_late_until?: string | null; status?: string; read_only?: boolean },
  formatDate: (iso: string) => string,
): { text: string; closed: boolean } {
  const open = a.accepts_submissions ?? (a.status === "published" && !a.read_only);
  if (!open) return { text: "Closed: no more submissions", closed: true };
  if (a.accepts_late_until) return { text: `Late work accepted until ${formatDate(a.accepts_late_until)}`, closed: false };
  return { text: "Late work accepted until your teacher closes the assignment", closed: false };
}
