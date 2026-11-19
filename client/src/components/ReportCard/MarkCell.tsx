import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, X, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { WorkbenchCell } from "../../services/reportCardWorkflowApi";

/**
 * One student's mark in one module on the workbench. Shows the mark as a
 * percentage (out of 100), coloured by the RTB competence decision, a thin
 * bar for how much of the term is assessed so far, and a dot when marks are
 * missing. Clicking opens the breakdown: points per category, how the mark
 * is worked out, and what's still missing.
 */

const CATS = ["CW", "HW", "MD", "EOT"] as const;
const CAT_NAME: Record<(typeof CATS)[number], string> = {
  CW: "Class work",
  HW: "Homework",
  MD: "Midterm",
  EOT: "End of term exam",
};
const TYPE_NAME: Record<string, string> = { quiz: "Quiz", assignment: "Assignment", manual: "Manual mark" };
const DEFAULT_WEIGHTS = { CW: 15, HW: 10, MD: 25, EOT: 50 };

export interface MarkCellProps {
  cell: WorkbenchCell | undefined;
  studentName: string;
  moduleName: string;
  moduleCode?: string | null;
  /** Mark needed to be Competent (RTB: 70 for specific, 50 general/complementary). */
  threshold?: number;
  weights?: { CW: number; HW: number; MD: number; EOT: number };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function MarkCell({ cell, studentName, moduleName, moduleCode, threshold, weights = DEFAULT_WEIGHTS }: MarkCellProps) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const width = 288;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
    const below = r.bottom + 8;
    const top = below + 280 > window.innerHeight ? Math.max(8, r.top - 8 - 280) : below;
    setPos({ top, left, maxHeight: Math.max(200, window.innerHeight - top - 8) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const total = cell?.total ?? null;
  const missing = cell?.missing ?? 0;
  if (total == null && !missing) {
    return (
      <span className="text-text-secondary-light/50 dark:text-text-secondary-dark/40" aria-label="No marks">
        —
      </span>
    );
  }

  const covered = cell?.covered ?? (total != null ? 100 : 0);
  const competent = cell?.competent ?? (total != null && threshold != null ? total >= threshold : null);
  const tone =
    total == null
      ? "text-text-secondary-light dark:text-text-secondary-dark"
      : competent === false
        ? "text-red-700 dark:text-red-400"
        : "text-text-primary-light dark:text-text-primary-dark";
  const label =
    total == null
      ? `${moduleName}: no marks yet, ${missing} missing`
      : `${moduleName}: ${fmt(total)}%${covered < 100 ? ` over ${covered}% of the term assessed` : ""}${missing ? `, ${missing} mark(s) missing` : ""}. Show breakdown`;
  const missingTitles = cell?.missing_items?.map((m) => m.title) ?? [];
  const hover = missingTitles.length ? `Missing: ${missingTitles.join(", ")}` : undefined;

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        title={hover}
        className={`group/cell relative inline-flex min-w-[52px] flex-col items-center rounded-lg px-1.5 py-1 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-500/10 ${
          open ? "bg-blue-50 dark:bg-blue-500/10" : ""
        }`}
      >
        <span className={`flex items-baseline gap-0.5 tabular-nums ${tone}`}>
          <span className="text-[13px] font-semibold">{total != null ? Math.round(total) : "—"}</span>
          {total != null && <span className="text-[10px] font-medium opacity-60">%</span>}
          {missing > 0 && (
            <span className="ml-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              {missing}
            </span>
          )}
        </span>
        {/* How much of the term is assessed: a full bar = all of CW+HW+MD+EOT has marks. */}
        <span className="mt-0.5 h-[3px] w-9 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" aria-hidden="true">
          <span className="block h-full rounded-full bg-blue-500/80" style={{ width: `${Math.max(0, Math.min(100, covered))}%` }} />
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={`${moduleName} — ${studentName}`}
            style={{ top: pos.top, left: pos.left, width: 288, maxHeight: pos.maxHeight }}
            className="fixed z-[1000] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 text-left text-sm dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary-light dark:text-text-primary-dark">{moduleName}</p>
                <p className="truncate text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  {[moduleCode, studentName].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-white/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Mark</p>
                <p className={`text-2xl font-bold tabular-nums ${tone}`}>
                  {total != null ? `${fmt(total)}%` : "—"}
                  <span className="ml-1 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">out of 100</span>
                </p>
              </div>
              {competent != null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    competent
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  }`}
                >
                  {competent ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {competent ? "Competent" : "Not yet competent"}
                </span>
              )}
            </div>
            {threshold != null && (
              <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">Competent from {threshold}%.</p>
            )}

            <ul className="mt-3 space-y-1.5">
              {CATS.map((c) => {
                const v = cell?.categories?.[c] ?? null;
                const w = weights[c];
                return (
                  <li key={c} className="grid grid-cols-[86px_1fr_auto] items-center gap-2 text-xs">
                    <span className="text-text-secondary-light dark:text-text-secondary-dark" title={CAT_NAME[c]}>
                      <strong className="font-semibold text-text-primary-light dark:text-text-primary-dark">{c}</strong> {CAT_NAME[c].split(" ")[0]}
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      {v != null && <span className="block h-full rounded-full bg-blue-600" style={{ width: `${w ? (v / w) * 100 : 0}%` }} />}
                    </span>
                    <span className="tabular-nums text-text-primary-light dark:text-text-primary-dark">
                      {v != null ? (
                        <>
                          {fmt(v)}
                          <span className="text-text-secondary-light dark:text-text-secondary-dark">/{w}</span>
                        </>
                      ) : (
                        <span className="text-text-secondary-light dark:text-text-secondary-dark">not yet</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            {total != null && cell?.points != null && (
              <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-text-secondary-light dark:bg-white/5 dark:text-text-secondary-dark">
                {covered < 100 ? (
                  <>
                    <strong className="text-text-primary-light dark:text-text-primary-dark">{fmt(cell.points)}</strong> of the{" "}
                    <strong className="text-text-primary-light dark:text-text-primary-dark">{covered}</strong> points assessed so far ={" "}
                    <strong className="text-text-primary-light dark:text-text-primary-dark">{fmt(total)}%</strong>. Categories with no marks yet are left
                    out until they are assessed.
                  </>
                ) : (
                  <>
                    <strong className="text-text-primary-light dark:text-text-primary-dark">{fmt(cell.points)}</strong> of 100 points ={" "}
                    <strong className="text-text-primary-light dark:text-text-primary-dark">{fmt(total)}%</strong>. The whole term is assessed.
                  </>
                )}
              </p>
            )}
            {missing > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10" data-testid="missing-marks">
                <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {missing} mark{missing === 1 ? "" : "s"} not recorded yet
                </p>
                {cell?.missing_items?.length ? (
                  <ul className="mt-2 space-y-1">
                    {cell.missing_items.map((m) => {
                      const body = (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-text-primary-light dark:text-text-primary-dark" title={m.title}>
                              {m.title}
                            </span>
                            <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                              {TYPE_NAME[m.assessment_type] ?? m.assessment_type} · {m.category}
                              {m.category in CAT_NAME ? ` (${CAT_NAME[m.category as keyof typeof CAT_NAME]})` : ""}
                            </span>
                          </span>
                          {m.href && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />}
                        </>
                      );
                      return (
                        <li key={`${m.assessment_type}:${m.assessment_id}`}>
                          {m.href ? (
                            <Link
                              to={m.href}
                              onClick={() => setOpen(false)}
                              className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-900 dark:hover:bg-blue-500/10"
                            >
                              {body}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs dark:bg-slate-900">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-300">
                  Record {missing === 1 ? "it" : "them"}, or mark absent/exempt when submitting the module.
                </p>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
