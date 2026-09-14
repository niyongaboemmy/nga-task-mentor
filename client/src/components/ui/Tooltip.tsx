import { useState, useId, useRef, useLayoutEffect, cloneElement, type ReactElement, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
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

const VIEWPORT_MARGIN = 8;
const GAP = 6;

// Renders through a portal to document.body with `position: fixed`, computed
// from the trigger's live bounding box — NOT `position: absolute` inside the
// trigger's own DOM position. A tooltip anchored the old way gets clipped by
// any scrolling/`overflow` ancestor between it and the page (e.g. the
// "Available Assessments" list), no matter its z-index — z-index can't win
// against a clipping ancestor. Portaling to <body> escapes every such
// ancestor, which is the actual, permanent fix (the same technique Radix/
// Floating UI use), not a per-usage z-index bump.
export default function Tooltip({ label, children, side = "top", disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!visible) return;

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const bubbleRect = bubbleRef.current?.getBoundingClientRect();
      const bubbleWidth = bubbleRect?.width ?? 0;
      const bubbleHeight = bubbleRect?.height ?? 24;

      // Flip to the side with room, so a tooltip near the top or bottom edge
      // of the viewport never gets cut off either.
      let placement = side;
      if (placement === "top" && anchorRect.top - bubbleHeight - GAP < VIEWPORT_MARGIN) placement = "bottom";
      else if (placement === "bottom" && anchorRect.bottom + bubbleHeight + GAP > window.innerHeight - VIEWPORT_MARGIN) placement = "top";

      let left = anchorRect.left + anchorRect.width / 2 - bubbleWidth / 2;
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - bubbleWidth - VIEWPORT_MARGIN));

      // Pixel-exact top (not a CSS `transform: translateY(-100%)`) — a raw
      // transform string here would fight framer-motion, which manages
      // `transform` itself for the `scale` animation below and silently
      // drops anything set directly via `style`. That was the actual bug:
      // the "flip up" offset never applied, so the tooltip rendered
      // downward from the anchor and covered the button it was labeling.
      const top = placement === "top" ? anchorRect.top - GAP - bubbleHeight : anchorRect.bottom + GAP;
      setPos({ top, left, placement });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [visible, side]);

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
    <>
      <span ref={anchorRef} className="inline-flex">
        {trigger}
      </span>
      {createPortal(
        <AnimatePresence>
          {visible && (
            <motion.div
              ref={bubbleRef}
              id={id}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: pos ? 1 : 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12, delay: 0.15 }}
              style={{
                position: "fixed",
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
              }}
              className="pointer-events-none z-[9999] whitespace-nowrap px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-900 text-white shadow-lg shadow-black/30 border border-white/10"
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
