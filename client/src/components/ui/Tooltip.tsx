import { useState, useId, cloneElement, type ReactElement, type HTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";

type TriggerProps = HTMLAttributes<HTMLElement>;

export interface TooltipProps {
  /** Short tool/action description shown on hover or keyboard focus. */
  label: string;
  /** A single focusable/hoverable element (button, link, icon wrapper…). */
  children: ReactElement<TriggerProps>;
  side?: "top" | "bottom";
  /** Tooltips are opt-out disabled (e.g. while a menu they'd fight with is open). */
  disabled?: boolean;
}

// Lightweight, dependency-free tooltip: shows on hover *and* keyboard focus
// (so it's discoverable without a mouse too), fades in on a short delay to
// avoid flicker while moving the pointer across a toolbar.
export default function Tooltip({ label, children, side = "top", disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  if (disabled) return children;

  const trigger = cloneElement<TriggerProps>(children, {
    "aria-describedby": id,
    onMouseEnter: (e) => {
      setVisible(true);
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e) => {
      setVisible(false);
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e) => {
      setVisible(true);
      children.props.onFocus?.(e);
    },
    onBlur: (e) => {
      setVisible(false);
      children.props.onBlur?.(e);
    },
  } as Partial<TriggerProps>);

  return (
    <span className="relative inline-flex">
      {trigger}
      <AnimatePresence>
        {visible && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12, delay: 0.15 }}
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-[999] whitespace-nowrap px-2 py-1 rounded-lg text-[11px] font-medium
              bg-gray-900 text-white shadow-lg shadow-black/30 border border-white/10
              ${side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
