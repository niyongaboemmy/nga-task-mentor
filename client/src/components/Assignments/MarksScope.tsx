import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Check, ChevronDown, Loader2, Puzzle } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/axiosConfig";

/**
 * An assignment's marks status: "counted" (the default) or "part_of" -- the
 * marks belong to another assessment (e.g. Section C of an exam that is
 * recorded as one mark out of 100), so dashboards, rankings, reports and
 * report cards leave them out. Students still see the mark.
 */
export type MarksScope = "counted" | "part_of";

export const marksScopeOf = (v: unknown): MarksScope => (v === "part_of" ? "part_of" : "counted");

const OPTIONS: Array<{
  value: MarksScope;
  label: string;
  hint: string;
  icon: React.ElementType;
  on: string;
  iconOn: string;
}> = [
  {
    value: "counted",
    label: "Counted",
    hint: "Marks count in dashboards, rankings, reports and report cards.",
    icon: BarChart3,
    on: "border-blue-500 bg-blue-50/60 dark:bg-blue-900/20",
    iconOn: "bg-blue-600 text-white",
  },
  {
    value: "part_of",
    label: "Part of another assessment",
    hint: "Graded here and shown to students, but left out of every total.",
    icon: Puzzle,
    on: "border-violet-500 bg-violet-50/60 dark:bg-violet-900/20",
    iconOn: "bg-violet-600 text-white",
  },
];

const COUNTS_IN = ["Dashboards", "Rankings", "Reports", "Report cards", "Gradebook total"];

/** The two-card picker, with "what is it part of" when it isn't counted. */
export const MarksScopeControl: React.FC<{
  value: MarksScope;
  partOfTitle: string;
  onChange: (scope: MarksScope, partOfTitle: string) => void;
  idPrefix?: string;
  disabled?: boolean;
  /** "stack": one card per row (popovers); "auto": side by side from sm up. */
  layout?: "auto" | "stack";
}> = ({ value, partOfTitle, onChange, idPrefix = "marks", disabled, layout = "auto" }) => (
  <div data-testid="marks-scope-control">
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">Marks status</span>
    </div>
    <div className={`grid grid-cols-1 gap-2.5 ${layout === "auto" ? "sm:grid-cols-2" : ""}`} role="radiogroup" aria-label="Marks status">
      {OPTIONS.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value, o.value === "part_of" ? partOfTitle : "")}
            className={`group relative flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition disabled:opacity-60 ${
              on ? o.on : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                on ? o.iconOn : "bg-gray-100 text-gray-500 group-hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              <o.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{o.label}</span>
              <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">{o.hint}</span>
            </span>
            {on && (
              <motion.span
                layoutId={`${idPrefix}-marks-check`}
                className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-600 shadow dark:bg-gray-900"
              >
                <Check className="h-3 w-3" />
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
    <AnimatePresence initial={false}>
      {value === "part_of" && (
        <motion.div
          key="part-of"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-3.5 dark:border-violet-500/30 dark:bg-violet-500/10">
            <label htmlFor={`${idPrefix}-part-of`} className="mb-1.5 block text-xs font-semibold text-violet-900 dark:text-violet-200">
              What is it part of? <span className="font-normal text-violet-700/80 dark:text-violet-300/80">(optional, shown to students)</span>
            </label>
            <input
              id={`${idPrefix}-part-of`}
              type="text"
              maxLength={255}
              value={partOfTitle}
              disabled={disabled}
              onChange={(e) => onChange("part_of", e.target.value)}
              placeholder="e.g. End-of-term exam, Section C"
              className="w-full rounded-xl border border-violet-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-violet-500 dark:border-violet-500/30 dark:bg-gray-800 dark:text-white"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-violet-900 dark:text-violet-200">Left out of:</span>
              {COUNTS_IN.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-white px-2 py-0.5 font-medium text-violet-700 line-through decoration-violet-400/70 dark:bg-gray-900 dark:text-violet-300"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-violet-800/80 dark:text-violet-200/80">
              Students still submit it, you still grade it, and they see their mark on the assignment.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/** A small badge for lists: nothing when counted. */
export const MarksScopeBadge: React.FC<{ scope?: unknown; partOfTitle?: string | null; className?: string }> = ({
  scope,
  partOfTitle,
  className = "",
}) =>
  marksScopeOf(scope) === "part_of" ? (
    <span
      data-testid="marks-scope-badge"
      title={`Part of ${partOfTitle || "another assessment"}: not counted in totals, rankings or reports`}
      className={`inline-flex max-w-full items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-200 ${className}`}
    >
      <Puzzle className="h-3 w-3 shrink-0" />
      <span className="truncate">{partOfTitle ? `Part of ${partOfTitle}` : "Part of another assessment"}</span>
    </span>
  ) : null;

/** Save only the marks status (PATCH /assignments/:id/marks-scope). */
export async function saveMarksScope(assignmentId: string | number, scope: MarksScope, partOfTitle: string) {
  const res = await api.patch(`/assignments/${assignmentId}/marks-scope`, {
    marks_scope: scope,
    part_of_title: scope === "part_of" ? partOfTitle.trim() : "",
  });
  return res.data?.data as { id: number; marks_scope: MarksScope; part_of_title: string | null };
}

/**
 * A badge-button that opens a popover to change the marks status of an
 * existing assignment in place.
 */
export const MarksScopeMenu: React.FC<{
  assignmentId: string | number;
  scope?: unknown;
  partOfTitle?: string | null;
  onChanged?: (scope: MarksScope, partOfTitle: string | null) => void;
  align?: "left" | "right";
}> = ({ assignmentId, scope, partOfTitle, onChanged, align = "right" }) => {
  const current = marksScopeOf(scope);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ scope: MarksScope; title: string }>({ scope: current, title: partOfTitle ?? "" });
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The panel lives in a portal (cards around the button clip overflow), placed
  // under the button and kept inside the viewport; phones get a bottom sheet.
  const [pos, setPos] = useState<{ top: number; left: number; width: number; sheet: boolean } | null>(null);

  const place = useCallback(() => {
    const btn = ref.current?.getBoundingClientRect();
    if (!btn) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < 640) {
      setPos({ top: 0, left: 0, width: vw, sheet: true });
      return;
    }
    const width = Math.min(416, vw - 32);
    const wanted = align === "right" ? btn.right - width : btn.left;
    const left = Math.max(16, Math.min(wanted, vw - width - 16));
    const height = panelRef.current?.offsetHeight ?? 360;
    // Below the button, or above it when there's no room underneath.
    const below = btn.bottom + 8;
    const top = below + height > vh - 16 && btn.top - 8 - height > 16 ? btn.top - 8 - height : Math.min(below, Math.max(16, vh - height - 16));
    setPos({ top, left, width, sheet: false });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Again once the panel has its real height.
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, draft.scope]);

  useEffect(() => {
    if (open) setDraft({ scope: current, title: partOfTitle ?? "" });
  }, [open, current, partOfTitle]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await saveMarksScope(assignmentId, draft.scope, draft.title);
      toast.success(r.marks_scope === "part_of" ? "Marks now left out of totals and reports." : "Marks now counted everywhere.");
      onChanged?.(r.marks_scope, r.part_of_title);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Couldn't change the marks status.");
    } finally {
      setSaving(false);
    }
  };

  // Known from the first render, before the panel is measured.
  const sheet = pos ? pos.sheet : typeof window !== "undefined" && window.innerWidth < 640;
  const changed = draft.scope !== current || (draft.scope === "part_of" && draft.title.trim() !== (partOfTitle ?? ""));
  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="marks-scope-menu"
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
          current === "part_of"
            ? "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200"
            : "border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300"
        }`}
      >
        {current === "part_of" ? <Puzzle className="h-3 w-3" /> : <BarChart3 className="h-3 w-3" />}
        <span className="max-w-[12rem] truncate">
          {current === "part_of" ? (partOfTitle ? `Part of ${partOfTitle}` : "Part of another assessment") : "Marks counted"}
        </span>
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && sheet && (
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40"
              aria-hidden="true"
            />
          )}
          {open && (
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-label="Marks status"
            onClick={(e) => e.stopPropagation()}
            initial={sheet ? { opacity: 1, scale: 1, y: "100%" } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={sheet ? { opacity: 1, y: "100%" } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: sheet ? 0.2 : 0.12 }}
            style={pos && !pos.sheet ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
            className={`fixed z-[61] border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 ${
              sheet
                ? "inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                : `max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl p-4 ${pos ? "" : "invisible"}`
            }`}
          >
            {sheet && <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-700" aria-hidden="true" />}
            <MarksScopeControl
              layout="stack"
              idPrefix={`menu-${assignmentId}`}
              value={draft.scope}
              partOfTitle={draft.title}
              disabled={saving}
              onChange={(s, t) => setDraft({ scope: s, title: t })}
            />
            <div className={`mt-4 flex gap-2 ${sheet ? "[&>button]:flex-1 [&>button]:justify-center [&>button]:py-2.5" : "justify-end"}`}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!changed || saving}
                data-testid="marks-scope-save"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};
