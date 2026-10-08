// Print → photo → scan, in a real browser: a real sheet (React, qrcode.react) is
// rendered with bubbles filled, photographed with distortions, and read back by
// the real scanner (omr.ts + jsQR). From client/:
//   npm i --no-save playwright && npx playwright install chromium
//   (npx vite --port 5199 --strictPort &) && node e2e-paper/scan.mjs
import { chromium } from "playwright";
const URL = process.env.HARNESS || "http://localhost:5199/taskmentor/e2e-paper/harness.html";
const results = [];
const check = (n, ok, d = "") => results.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);

// 30 questions: single choice (4–5 options), true/false, multiple choice.
const questions = Array.from({ length: 30 }, (_, i) => {
  const type = i % 7 === 3 ? "true_false" : i % 5 === 4 ? "multiple_choice" : "single_choice";
  return { id: 1000 + i, number: i + 1 + (i >= 10 ? 1 : 0), type, options: type === "true_false" ? 2 : i % 3 === 0 ? 5 : 4, points: 1 };
});
const spec = { quizId: 77, title: "S2 Biology — Cells", key: "a1b2c3d4e5", questions, manual: [11], maxScore: 31 };
const student = { id: 4321, name: "Aline Uwase" };
// What the student "filled": one bubble each, two on multiple choice, a blank, a double on purpose.
const filled = {};
questions.forEach((q, i) => {
  if (i === 6) return; // blank
  if (q.type === "multiple_choice") filled[q.id] = [0, (i % 3) + 1];
  else if (i === 12) filled[q.id] = [0, 1]; // two marked on a one-answer question
  else filled[q.id] = [(i * 7) % q.options];
});

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 900, height: 1300 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(URL);
await p.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
await p.evaluate(([s, st, f]) => window.renderSheet(s, st, f), [spec, student, filled]);
const png = await p.locator('[data-testid="paper-sheet"]').screenshot();
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

const photos = [
  { name: "flat scan", angle: 0, skew: 0, scale: 0.55, flip: false, shade: 0, noise: 0 },
  { name: "phone, tilted 6°, skewed", angle: 6, skew: 0.06, scale: 0.5, flip: false, shade: 0.25, noise: 30 },
  { name: "phone, tilted −9°, dim one side", angle: -9, skew: -0.04, scale: 0.45, flip: false, shade: 0.4, noise: 40 },
  { name: "upside down", angle: 3, skew: 0.02, scale: 0.5, flip: true, shade: 0.15, noise: 25 },
];
for (const photo of photos) {
  const r = await p.evaluate(([u, o, q]) => window.scanPhoto(u, o, q), [dataUrl, photo, questions]);
  if (!r.ok) { check(`${photo.name}: read`, false, r.error); continue; }
  check(`${photo.name}: QR → quiz ${r.quizId}, student ${r.studentId}`, r.quizId === 77 && r.studentId === 4321 && r.key === "a1b2c3d4e5");
  let wrong = [];
  r.answers.forEach((a, i) => {
    const want = filled[a.id] ?? [];
    const got = a.selected;
    const same = want.length === got.length && want.every((x, j) => [...got].sort()[j] === [...want].sort()[j]);
    if (!same) wrong.push(`Q${a.number}: want ${want} got ${got} (${a.status}, fills ${a.fills.map((f) => f.toFixed(2)).join("/")})`);
  });
  check(`${photo.name}: every bubble read right (${r.answers.length} questions, ${r.ms} ms on ${r.size.join("×")})`, wrong.length === 0, wrong.slice(0, 3).join("; "));
  const blank = r.answers[6], dbl = r.answers[12];
  check(`${photo.name}: blank and double marks flagged`, blank.status === "blank" && dbl.status === "multiple", `${blank.status}/${dbl.status}`);
}
console.log(results.join("\n"));
await b.close();
