import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MoreHorizontal } from "lucide-react";
import { computeVisibleTabs } from "./courseTabsLayout";

// ─── Course Details tab bar ───────────────────────────────────────────────────
// Priority+ navigation: as many tabs as fit on one line, the rest behind a
// "More" (⋯) menu, so the bar never scrolls sideways on a phone and never
// wraps on a laptop. The active tab is always kept on the bar — if it would
// have overflowed, the tabs before it give up their place instead. The menu also
// carries the page's quick actions, so the ⋯ button is useful even when every
// tab fits.

export interface CourseTabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Shown as a pill after the label; omitted while still loading. */
  count?: number;
  /** A tab that is really a link to another page (e.g. Question Bank). */
  href?: string;
}

export interface CourseTabAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface CourseTabsProps {
  tabs: CourseTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  actions?: CourseTabAction[];
}

const tabClass = (active: boolean) =>
  `relative whitespace-nowrap flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium rounded-t-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
    active
      ? "text-blue-600 dark:text-blue-400"
      : "text-text-secondary-light dark:text-text-secondary-dark/70 hover:text-text-primary-light dark:hover:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5"
  }`;

function CountPill({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={`min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums text-center leading-none ${
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
          : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
      }`}
    >
      {value}
    </span>
  );
}

function TabContent({ tab, active }: { tab: CourseTabItem; active: boolean }) {
  return (
    <>
      <span className="w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{tab.icon}</span>
      {tab.label}
      {typeof tab.count === "number" && <CountPill value={tab.count} active={active} />}
    </>
  );
}

export default function CourseTabs({ tabs, activeId, onSelect, actions = [] }: CourseTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLElement | null>>([]);
  const [visible, setVisible] = useState<number[]>(() => tabs.map((_, i) => i));
  const [menuOpen, setMenuOpen] = useState(false);

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  // A stable key for "the set of tab labels", so re-measuring happens when a
  // count arrives (the label gets wider) but not on every parent render.
  const labelsKey = tabs.map((t) => `${t.id}:${t.label}:${t.count ?? ""}`).join("|");

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const widths = Array.from(measure.children).map(
      (el) => (el as HTMLElement).getBoundingClientRect().width,
    );
    // jsdom (tests) reports zero for every width — show everything.
    if (widths.every((w) => w === 0)) {
      setVisible(tabs.map((_, i) => i));
      return;
    }
    const style = getComputedStyle(container);
    const available =
      container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const next = computeVisibleTabs(widths, available, activeIndex);
    setVisible((prev) =>
      prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelsKey, activeIndex]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute]);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const visibleSet = new Set(visible);
  const overflow = tabs.map((_, i) => i).filter((i) => !visibleSet.has(i));

  // Left/Right arrows move between the tabs on the bar (WAI-ARIA tabs pattern).
  const onTabKeyDown = (e: React.KeyboardEvent, position: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const nextPos = (position + step + visible.length) % visible.length;
    tabRefs.current[visible[nextPos]]?.focus();
  };

  const selectFromMenu = (tab: CourseTabItem) => {
    setMenuOpen(false);
    if (!tab.href) onSelect(tab.id);
  };

  return (
    <div className="relative border-b border-gray-200 dark:border-gray-800">
      {/* Off-screen copy of every tab, used only to measure natural widths. */}
      <div
        ref={measureRef}
        aria-hidden
        className="absolute left-0 top-0 flex w-max invisible pointer-events-none h-0 overflow-hidden"
      >
        {tabs.map((tab) => (
          <span key={tab.id} className={tabClass(tab.id === activeId)}>
            <TabContent tab={tab} active={tab.id === activeId} />
          </span>
        ))}
      </div>

      <div ref={containerRef} className="flex items-stretch px-2 sm:px-4">
        <div role="tablist" aria-label="Course sections" className="flex items-stretch min-w-0 flex-1">
          {visible.map((index, position) => {
            const tab = tabs[index];
            const active = tab.id === activeId;
            const content = (
              <>
                <TabContent tab={tab} active={active} />
                {active && (
                  <motion.span
                    layoutId="course-tab-underline"
                    className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-blue-500"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </>
            );
            if (tab.href) {
              return (
                <Link
                  key={tab.id}
                  to={tab.href}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  onKeyDown={(e) => onTabKeyDown(e, position)}
                  className={tabClass(false)}
                >
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                onKeyDown={(e) => onTabKeyDown(e, position)}
                onClick={() => onSelect(tab.id)}
                className={tabClass(active)}
              >
                {content}
              </button>
            );
          })}
        </div>

        <div ref={menuRef} className="relative flex items-center flex-shrink-0 pl-1">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={overflow.length > 0 ? `More sections (${overflow.length})` : "More options"}
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
              menuOpen
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
                : "text-text-secondary-light dark:text-text-secondary-dark/70 hover:bg-gray-100 dark:hover:bg-white/10"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            {overflow.length > 0 && (
              <span className="text-xs font-semibold hidden sm:inline">More</span>
            )}
            {overflow.length > 0 && (
              <span className="sm:hidden min-w-[1rem] h-4 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-4 text-center">
                {overflow.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-1 z-30 w-64 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-gray-200 dark:border-gray-700/70 bg-white dark:bg-gray-900 shadow-xl p-1.5"
              >
                {overflow.length > 0 && (
                  <>
                    <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/50">
                      Sections
                    </p>
                    {overflow.map((index) => {
                      const tab = tabs[index];
                      const active = tab.id === activeId;
                      const cls = `w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-colors ${
                        active
                          ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold"
                          : "text-text-primary-light dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5"
                      }`;
                      const inner = (
                        <>
                          <span className="w-4 h-4 flex items-center justify-center text-gray-400 [&>svg]:w-4 [&>svg]:h-4">
                            {tab.icon}
                          </span>
                          <span className="flex-1 truncate">{tab.label}</span>
                          {typeof tab.count === "number" && <CountPill value={tab.count} active={active} />}
                          {active && <Check className="w-4 h-4" />}
                        </>
                      );
                      return tab.href ? (
                        <Link key={tab.id} role="menuitem" to={tab.href} className={cls} onClick={() => selectFromMenu(tab)}>
                          {inner}
                        </Link>
                      ) : (
                        <button key={tab.id} type="button" role="menuitem" className={cls} onClick={() => selectFromMenu(tab)}>
                          {inner}
                        </button>
                      );
                    })}
                  </>
                )}

                {actions.length > 0 && (
                  <>
                    {overflow.length > 0 && <div className="my-1.5 h-px bg-gray-100 dark:bg-gray-800" />}
                    <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/50">
                      Quick actions
                    </p>
                    {actions.map((action) => (
                      <Link
                        key={action.id}
                        role="menuitem"
                        to={action.href}
                        onClick={() => setMenuOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-text-primary-light dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <span className="w-4 h-4 flex items-center justify-center text-gray-400 [&>svg]:w-4 [&>svg]:h-4">
                          {action.icon}
                        </span>
                        <span className="flex-1 truncate">{action.label}</span>
                      </Link>
                    ))}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
