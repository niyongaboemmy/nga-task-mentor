// Which tabs sit on the Course Details tab bar, given each tab's natural width
// and the room available. Kept out of CourseTabs.tsx so that file exports
// components only (React Fast Refresh) and so this can be unit-tested without
// a layout engine.

/** Room kept for the ⋯ button, which is always shown (it also holds quick actions). */
export const MORE_BUTTON_WIDTH = 88;

export function computeVisibleTabs(
  widths: number[],
  available: number,
  activeIndex: number,
  reserve = MORE_BUTTON_WIDTH,
): number[] {
  const all = widths.map((_, i) => i);
  const room = available - reserve;
  if (widths.reduce((a, w) => a + w, 0) <= room) return all;

  // Take tabs in order while they fit, always counting the active tab's width
  // so it can be kept on the bar even when it would naturally overflow.
  const active = Math.min(Math.max(0, activeIndex), widths.length - 1);
  const visible: number[] = [];
  let used = widths[active] ?? 0;
  for (const i of all) {
    if (i === active) continue;
    if (used + widths[i] > room) break;
    used += widths[i];
    visible.push(i);
  }
  visible.push(active);
  return visible.sort((a, b) => a - b);
}
