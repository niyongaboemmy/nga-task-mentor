// Test harness (not shipped): renders a real sheet and runs the real scanner on
// a distorted "photo" of it. Driven by e2e-paper/scan.mjs.
import React from "react";
import { createRoot } from "react-dom/client";
import { Sheet } from "../src/pages/PaperSheetsPage";
import { scanSheet, toGray } from "../src/paper/omr";

const root = createRoot(document.getElementById("root")!);
(window as any).renderSheet = (spec: any, student: any, filled: Record<string, number[]>) =>
  new Promise<void>((resolve) => {
    root.render(<Sheet spec={spec} student={student} quizTitle={spec.title} />);
    setTimeout(() => {
      for (const [qid, ks] of Object.entries(filled)) {
        for (const k of ks) document.querySelector(`.paper-bubble[data-q="${qid}"][data-k="${k}"]`)?.classList.add("filled");
      }
      resolve();
    }, 300);
  });

/** Draws the screenshot like a phone photo: smaller, rotated, skewed, shaded, noisy; then scans it. */
(window as any).scanPhoto = async (dataUrl: string, o: { angle: number; skew: number; scale: number; flip: boolean; shade: number; noise: number }, questions: any[]) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const W = Math.round(img.width * o.scale * 1.25), H = Math.round(img.height * o.scale * 1.15);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#6b7280"; // a desk under the sheet
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(((o.flip ? 180 : 0) + o.angle) * Math.PI / 180);
  ctx.transform(1, o.skew, -o.skew / 2, 1, 0, 0);
  ctx.scale(o.scale, o.scale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Uneven light: a shadow across one side.
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, `rgba(0,0,0,${o.shade})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * o.noise;
    data.data[i] += n; data.data[i + 1] += n; data.data[i + 2] += n;
  }
  const t0 = performance.now();
  const r = scanSheet(toGray(data.data, W, H), questions);
  return { ...r, ms: Math.round(performance.now() - t0), size: [W, H] };
};
(window as any).ready = true;
