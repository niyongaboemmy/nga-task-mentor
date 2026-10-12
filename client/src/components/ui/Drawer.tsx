import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Details beside a list (CODE_RUNNER_PLAN.md §6.4): a right-hand panel that
 * closes with Esc or the backdrop and gives focus back where it was.
 */
export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}> = ({ open, onClose, title, children, footer, width = "max-w-[480px]" }) => {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-drawer flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`relative flex h-full w-full ${width} flex-col bg-white shadow-2xl outline-none dark:bg-slate-900`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-white/10">
          <h2 className="min-w-0 truncate text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-gray-200 px-4 py-3 dark:border-white/10">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default Drawer;
