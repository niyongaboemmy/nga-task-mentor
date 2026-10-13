/** How much a page of `page` size is scaled to fit `box` (never enlarged). */
export function fitScale(page: { w: number; h: number }, box: { w: number; h: number }): number {
  if (box.w <= 0 || box.h <= 0) return 1;
  return Math.min(box.w / page.w, box.h / page.h, 1);
}
