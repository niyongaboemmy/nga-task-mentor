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
