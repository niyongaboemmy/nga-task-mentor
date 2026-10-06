import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  layoutClasses,
  parseSelectChildren,
  matchesQuery,
  type SelectItem,
} from "./selectUtils";

/**
 * The app's one select. Drop-in for a native <select>: same <option> /
 * <optgroup> children, `value`, `name`, and an `onChange` whose event has
 * `target.value` and `target.name` — so existing handlers keep working.
 *
 * It looks like the app's inputs (same height, radius, surface and focus
 * ring) and opens an animated list with keyboard support, typeahead and a
 * search box for long lists. A hidden native <select> mirrors the value so
 * plain <form> submissions still carry it.
 *
 * `className` positions the control (width, margins, flex/grid placement);
 * visual classes in it are ignored so every select looks the same.
 */

export type SelectSize = "sm" | "md" | "lg";
export type SelectVariant = "filled" | "outline" | "ghost" | "bare";

export interface SelectProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "value" | "defaultValue" | "children" | "type"
  > {
  value?: string | number | null;
  defaultValue?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Convenience: called with the new value only. */
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  size?: SelectSize;
  variant?: SelectVariant;
  invalid?: boolean;
  /** Shown when nothing is selected and there is no empty-value option. */
  placeholder?: string;
  /** Search box in the list. Default: on when there are more than 8 options. */
  searchable?: boolean;
  /** Icon shown before the value. */
  icon?: React.ReactNode;
  /** Classes for the trigger itself, applied after the defaults (escape hatch). */
  triggerClassName?: string;
  children?: React.ReactNode;
}

const SIZES: Record<SelectSize, { trigger: string; text: string; option: string }> = {
  sm: { trigger: "h-8 pl-2.5 pr-2 gap-1.5 rounded-lg", text: "text-xs", option: "px-2.5 py-1.5 text-xs" },
  md: { trigger: "h-10 pl-3.5 pr-2.5 gap-2 rounded-xl", text: "text-sm", option: "px-3 py-2 text-sm" },
  lg: { trigger: "h-12 pl-4 pr-3 gap-2 rounded-xl", text: "text-base", option: "px-3.5 py-2.5 text-base" },
};

const VARIANTS: Record<SelectVariant, string> = {
  // Same as the app's search inputs: soft surface, border only on focus.
  filled:
    "bg-surface-light dark:bg-surface-dark/50 border border-transparent hover:bg-gray-100 dark:hover:bg-surface-dark/80",
  // Same as bordered form inputs (FormField).
  outline:
    "bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
  // Toolbars: no chrome until hovered.
  ghost: "bg-transparent border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800",
  // Coloured chips (status, difficulty…): colours come from triggerClassName.
  bare: "border hover:brightness-95 dark:hover:brightness-110",
};

const SEARCH_THRESHOLD = 8;
const LIST_MAX_HEIGHT = 288;

type Placement = { top: number; left: number; width: number; maxHeight: number; up: boolean };

function makeChangeEvent(
  value: string,
  name: string | undefined,
  id: string | undefined,
  native: HTMLSelectElement | null,
): React.ChangeEvent<HTMLSelectElement> {
  // Handlers read target.value / target.name; give them a real <select>
  // (the hidden mirror) when we have one, set to the new value.
  let target: HTMLSelectElement | { value: string; name: string; id: string; type: string };
  if (native) {
    native.value = value;
    target = native;
  } else {
    target = { value, name: name ?? "", id: id ?? "", type: "select-one" };
  }
  const event = {
    target,
    currentTarget: target,
    type: "change",
    bubbles: true,
    defaultPrevented: false,
    isTrusted: true,
    timeStamp: Date.now(),
    nativeEvent: new Event("change"),
    preventDefault: () => {},
    stopPropagation: () => {},
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    persist: () => {},
  };
  return event as unknown as React.ChangeEvent<HTMLSelectElement>;
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value,
    defaultValue,
    onChange,
    onValueChange,
    name,
    required,
    disabled,
    size = "md",
    variant = "filled",
    invalid,
    placeholder,
    searchable,
    icon,
    className = "",
    triggerClassName = "",
    children,
    id,
    onKeyDown,
    onBlur,
    ...rest
  },
  forwardedRef,
) {
  const { items, options } = useMemo(() => parseSelectChildren(children), [children]);
  const controlled = value !== undefined;
  const [inner, setInner] = useState<string>(() =>
    defaultValue !== undefined ? String(defaultValue) : options[0]?.value ?? "",
  );
  const current = controlled ? (value === null ? "" : String(value)) : inner;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const autoId = useId();
  const triggerId = id ?? `sel-${autoId}`;
  const listId = `${triggerId}-list`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const nativeRef = useRef<HTMLSelectElement | null>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const setTriggerRef = (el: HTMLButtonElement | null) => {
    triggerRef.current = el;
    if (typeof forwardedRef === "function") forwardedRef(el);
    else if (forwardedRef) forwardedRef.current = el;
  };

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const visible = useMemo(
    () => (query ? options.filter((o) => matchesQuery(o.label, query)) : options),
    [options, query],
  );
  const visibleItems: SelectItem[] = useMemo(() => {
    if (!query) return items;
    // keep group headings only when one of their options survives
    const keep = new Set(visible.map((o) => o.key));
    return items.filter((it, i) => {
      if (it.kind === "option") return keep.has(it.key);
      for (let j = i + 1; j < items.length && items[j].kind === "option"; j++) {
        if (keep.has(items[j].key)) return true;
      }
      return false;
    });
  }, [items, visible, query]);

  const commit = useCallback(
    (next: string) => {
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
      if (next === current) return;
      if (!controlled) setInner(next);
      onValueChange?.(next);
      onChange?.(makeChangeEvent(next, name, id, nativeRef.current));
    },
    [controlled, current, id, name, onChange, onValueChange],
  );

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = vh - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 220 && above > below;
    const maxHeight = Math.max(160, Math.min(LIST_MAX_HEIGHT + (showSearch ? 52 : 0), up ? above : below));
    const width = Math.min(Math.max(r.width, 200), vw - 16);
    const left = Math.min(Math.max(8, r.left), vw - width - 8);
    setPlacement({ top: up ? r.top - 6 : r.bottom + 6, left, width, maxHeight, up });
  }, [showSearch]);

  const openList = useCallback(() => {
    if (disabled) return;
    place();
    setActive(Math.max(0, options.findIndex((o) => o.value === current && !o.disabled)));
    setOpen(true);
  }, [current, disabled, options, place]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, showSearch]);

  // keep the active option in view
  useEffect(() => {
    if (!open || active < 0) return;
    const opt = visible[active];
    if (!opt) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(opt.key)}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active, open, visible]);

  const moveActive = (from: number, step: 1 | -1) => {
    if (!visible.length) return -1;
    let i = from;
    for (let n = 0; n < visible.length; n++) {
      i = (i + step + visible.length) % visible.length;
      if (!visible[i].disabled) return i;
    }
    return from;
  };

  const typeTo = (ch: string) => {
    const now = Date.now();
    const t = typeahead.current;
    t.text = now - t.at > 700 ? ch : t.text + ch;
    t.at = now;
    const start = open ? active : options.findIndex((o) => o.value === current);
    const pool = open ? visible : options;
    for (let n = 1; n <= pool.length; n++) {
      const i = (Math.max(start, 0) + (t.text.length > 1 ? n - 1 : n)) % pool.length;
      const o = pool[i];
      if (!o.disabled && o.label.toLowerCase().startsWith(t.text.toLowerCase())) {
        if (open) setActive(i);
        else commit(o.value);
        return;
      }
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (!open) {
      if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") {
        e.preventDefault();
        openList();
      } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        typeTo(k);
      }
      return;
    }
    if (k === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't close the surrounding modal
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    } else if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      setActive((a) => moveActive(a, k === "ArrowDown" ? 1 : -1));
    } else if (k === "Home" || k === "End") {
      e.preventDefault();
      setActive(k === "Home" ? moveActive(-1, 1) : moveActive(visible.length, -1));
    } else if (k === "Enter" || (k === " " && !showSearch)) {
      e.preventDefault();
      const o = visible[active];
      if (o && !o.disabled) commit(o.value);
    } else if (k === "Tab") {
      setOpen(false);
      setQuery("");
    } else if (!showSearch && k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      typeTo(k);
    }
  };

  const sz = SIZES[size];
  const layout = layoutClasses(className);
  // Like a native select, size to the longest option unless given a width.
  const autoWidth = !/(^|\s|:)(w|flex|basis|grow)-|(^|\s|:)(flex-1|grow)(\s|$)/.test(layout);
  const label = selected?.label ?? "";
  const isPlaceholder = !selected || selected.value === "";
  const shownLabel = selected ? label || placeholder || "" : placeholder || "Select…";
  const activeKey = open && active >= 0 ? visible[active]?.key : undefined;

  return (
    <div className={`relative inline-flex min-w-0 ${layout}`} data-select-root="">
      <button
        {...rest}
        ref={setTriggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !showSearch && activeKey ? `${listId}-${activeKey}` : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        data-value={current}
        disabled={disabled}
        onClick={() => (open ? (setOpen(false), setQuery("")) : openList())}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!e.defaultPrevented) handleKey(e);
        }}
        onBlur={onBlur}
        className={`group w-full inline-flex items-center justify-between text-left transition-all duration-150 outline-none
          ${sz.trigger} ${sz.text} ${VARIANTS[variant]}
          text-text-primary-light dark:text-text-primary-dark
          focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20
          ${open ? `${variant === "bare" ? "" : "border-blue-500"} ring-2 ring-blue-500/20` : ""}
          ${invalid ? "!border-red-400 focus-visible:ring-red-500/20" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.99]"}
          ${triggerClassName}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="flex-shrink-0 text-gray-400">{icon}</span>}
          {autoWidth ? (
            <span className="grid">
              {[shownLabel, ...options.map((o) => o.label)].map((l, i) => (
                <span
                  key={i}
                  aria-hidden={i > 0 || undefined}
                  className={`col-start-1 row-start-1 whitespace-nowrap ${
                    i > 0 ? "invisible h-0" : isPlaceholder ? "text-text-secondary-light dark:text-text-secondary-dark" : ""
                  }`}
                >
                  {l}
                </span>
              ))}
            </span>
          ) : (
            <span
              className={`truncate ${isPlaceholder ? "text-text-secondary-light dark:text-text-secondary-dark" : ""}`}
            >
              {shownLabel}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={`flex-shrink-0 transition-transform duration-200 ${
            variant === "bare" ? "opacity-70" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
          } ${
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
          } ${open ? "rotate-180 text-blue-500" : ""}`}
        />
      </button>

      {/* Mirror for plain form submissions and change events; never focused. */}
      <select
        ref={nativeRef}
        name={name}
        value={current}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        hidden
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o.key} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && placement && (
              <motion.div
                ref={listRef}
                initial={{ opacity: 0, scale: 0.97, y: placement.up ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: placement.up ? 4 : -4 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  left: placement.left,
                  width: placement.width,
                  maxHeight: placement.maxHeight,
                  ...(placement.up
                    ? { bottom: window.innerHeight - placement.top, transformOrigin: "bottom" }
                    : { top: placement.top, transformOrigin: "top" }),
                }}
                className="z-[1000] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/40"
                onKeyDown={showSearch ? handleKey : undefined}
              >
                {showSearch && (
                  <div className="border-b border-gray-100 p-1.5 dark:border-gray-800">
                    <div className="flex items-center gap-2 rounded-lg bg-surface-light px-2.5 dark:bg-surface-dark/50">
                      <Search className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                      <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setActive(0);
                        }}
                        placeholder="Search…"
                        aria-label="Search options"
                        aria-controls={listId}
                        aria-activedescendant={activeKey ? `${listId}-${activeKey}` : undefined}
                        className="h-8 w-full bg-transparent text-sm text-text-primary-light outline-none placeholder:text-gray-400 dark:text-text-primary-dark"
                      />
                    </div>
                  </div>
                )}
                <div
                  id={listId}
                  role="listbox"
                  aria-labelledby={triggerId}
                  className="overflow-y-auto overscroll-contain p-1"
                >
                  {visibleItems.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-gray-400">No matches</p>
                  )}
                  {visibleItems.map((it) => {
                    if (it.kind === "group") {
                      return (
                        <div
                          key={it.key}
                          role="presentation"
                          className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 first:pt-1"
                        >
                          {it.label}
                        </div>
                      );
                    }
                    const idx = visible.findIndex((o) => o.key === it.key);
                    const isSel = it.value === current;
                    const isActive = idx === active;
                    return (
                      <div
                        key={it.key}
                        id={`${listId}-${it.key}`}
                        data-key={it.key}
                        data-value={it.value}
                        role="option"
                        aria-selected={isSel}
                        aria-disabled={it.disabled || undefined}
                        onPointerMove={() => !it.disabled && idx !== active && setActive(idx)}
                        onClick={() => !it.disabled && commit(it.value)}
                        className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg ${sz.option} transition-colors
                          ${it.disabled ? "cursor-not-allowed opacity-40" : ""}
                          ${isActive && !it.disabled ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200" : "text-text-primary-light dark:text-text-primary-dark"}
                          ${isSel ? "font-semibold" : ""}
                          ${it.value === "" && !isActive ? "text-text-secondary-light dark:text-text-secondary-dark" : ""}`}
                      >
                        <span className="truncate">{it.label || " "}</span>
                        {isSel && <Check className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
});

export default Select;
