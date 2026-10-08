import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Camera, CheckCircle2, FileWarning, Printer, Save, ScanLine } from "lucide-react";
import { QuizApiService, type PaperSaveResult, type PaperSheetSpec } from "../services/quizApi";
import { CAPACITY, GRID, MARKER, MARKERS, PAGE, QR, bubble, bubbleLabels, cell, qrPayload } from "../paper/layout";
import { scanSheet, toGray, type QuestionStatus, type ScanResult } from "../paper/omr";
import "../paper/paper.css";

type Student = { id: number; name: string };

interface Reviewed {
  file: string;
  result: ScanResult;
  /** quiz_questions.id → selected bubbles, as the teacher confirmed them. */
  picks: Record<number, number[]>;
  problem?: string;
}

const STATUS_STYLE: Record<QuestionStatus, string> = {
  ok: "",
  blank: "bg-slate-100 dark:bg-slate-800",
  multiple: "bg-rose-50 dark:bg-rose-500/10",
  unsure: "bg-amber-50 dark:bg-amber-500/10",
};
const STATUS_LABEL: Record<QuestionStatus, string> = { ok: "", blank: "Blank", multiple: "Two marked", unsure: "Faint mark" };

/** One A4 sheet, positioned in millimetres from layout.ts. */
export const Sheet: React.FC<{ spec: PaperSheetSpec; student: Student; quizTitle: string }> = ({ spec, student, quizTitle }) => (
  <div className="paper-sheet" data-testid="paper-sheet" data-student={student.id} style={{ width: `${PAGE.w}mm`, height: `${PAGE.h}mm` }}>
    {MARKERS.map(([x, y], i) => (
      <div key={i} className="paper-marker" style={{ left: `${x - MARKER.size / 2}mm`, top: `${y - MARKER.size / 2}mm`, width: `${MARKER.size}mm`, height: `${MARKER.size}mm` }} />
    ))}
    <div className="paper-head" style={{ left: "20mm", top: "22mm", width: "136mm" }}>
      <p className="paper-title">{quizTitle}</p>
      <p className="paper-name">{student.name}</p>
      <p className="paper-help">Fill one bubble per question completely with a dark pen or pencil (several only where a question says "choose all"). Don't fold or write near the corners.</p>
      {spec.manual.length > 0 && <p className="paper-help">Questions {spec.manual.join(", ")}: answer on your answer paper.</p>}
    </div>
    <div className="paper-qr" style={{ left: `${QR.x}mm`, top: `${QR.y}mm`, width: `${QR.size}mm`, height: `${QR.size}mm` }}>
      <QRCodeSVG value={qrPayload(spec.quizId, student.id, spec.key)} level="L" marginSize={0} style={{ width: "100%", height: "100%" }} />
    </div>
    {spec.questions.map((q, i) => {
      const c = cell(i);
      return (
        <React.Fragment key={q.id}>
          <div className="paper-num" style={{ left: `${c.x}mm`, top: `${c.y}mm`, width: `${GRID.labelW}mm`, height: `${GRID.rowH}mm` }}>
            {q.number}
            {q.type === "multiple_choice" && <span className="paper-all">all</span>}
          </div>
          {bubbleLabels(q).map((label, k) => {
            const b = bubble(i, k);
            return (
              <div key={k} className="paper-bubble" data-q={q.id} data-k={k} style={{ left: `${b.x - GRID.r}mm`, top: `${b.y - GRID.r}mm`, width: `${GRID.r * 2}mm`, height: `${GRID.r * 2}mm` }}>
                {label}
              </div>
            );
          })}
        </React.Fragment>
      );
    })}
  </div>
);

/** Image file → grey pixels, longest side at most 2000 px. */
async function fileToGray(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return toGray(ctx.getImageData(0, 0, w, h).data, w, h);
}

/**
 * Paper answer sheets for one quiz: print one per student, then scan the
 * filled sheets (phone photos or a scanner), check what was read, and save.
 */
const PaperSheetsPage: React.FC = () => {
  const { quizId } = useParams();
  const id = Number(quizId);
  const [tab, setTab] = useState<"print" | "scan">("print");
  const [spec, setSpec] = useState<PaperSheetSpec | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Reviewed[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<PaperSaveResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, st] = await Promise.all([QuizApiService.getPaperSheet(id), QuizApiService.getQuizStudents(id)]);
        setSpec(s.data);
        const list = (st.data || []).map((x) => ({ id: Number(x.id), name: x.name || `Student ${x.id}` }));
        setStudents(list);
        setChosen(new Set(list.map((x) => x.id)));
      } catch (e: any) {
        setError(e?.response?.data?.message || "Couldn't prepare the answer sheets.");
      }
    })();
  }, [id]);

  const nameOf = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students]);

  const scan = async (files: FileList | null) => {
    if (!files?.length || !spec) return;
    setBusy(true);
    setSaved(null);
    const next: Reviewed[] = [];
    for (const f of Array.from(files)) {
      // Let the page breathe between sheets.
      await new Promise((r) => setTimeout(r, 0));
      let result: ScanResult;
      try {
        result = scanSheet(await fileToGray(f), spec.questions);
      } catch {
        result = { ok: false, error: "This file isn't an image the browser can read." };
      }
      let problem: string | undefined = result.ok ? undefined : result.error;
      if (result.ok && result.quizId !== spec.quizId) problem = "This sheet belongs to another quiz.";
      else if (result.ok && result.key !== spec.key) problem = "Printed before the quiz's questions changed: print new sheets.";
      const picks: Record<number, number[]> = {};
      for (const a of result.answers ?? []) picks[a.id] = a.selected;
      next.push({ file: f.name, result, picks, problem });
    }
    setSheets((prev) => {
      // A rescan of the same student replaces the earlier one.
      const merged = [...prev];
      for (const s of next) {
        const i = s.result.studentId ? merged.findIndex((m) => m.result.studentId === s.result.studentId && !m.problem) : -1;
        if (i >= 0 && !s.problem) merged[i] = s;
        else merged.push(s);
      }
      return merged;
    });
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggle = (sheetIdx: number, qid: number, k: number, multi: boolean) => {
    setSheets((prev) =>
      prev.map((s, i) => {
        if (i !== sheetIdx) return s;
        const cur = s.picks[qid] ?? [];
        // One-answer questions: a click means "this one" (clearing a double mark); clicking the sole pick clears it.
        const nextPick = multi
          ? cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].sort((a, b) => a - b)
          : cur.length === 1 && cur[0] === k ? [] : [k];
        return { ...s, picks: { ...s.picks, [qid]: nextPick } };
      }),
    );
  };

  const good = sheets.filter((s) => s.result.ok && !s.problem);
  const toCheck = good.reduce((n, s) => n + (s.result.answers ?? []).filter((a) => a.status !== "ok").length, 0);

  const save = async () => {
    if (!spec || !good.length) return;
    setBusy(true);
    try {
      const res = await QuizApiService.savePaperResults(
        spec.quizId,
        spec.key,
        good.map((s) => ({ studentId: s.result.studentId!, answers: Object.fromEntries(Object.entries(s.picks).map(([k, v]) => [k, v])) })),
      );
      setSaved(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Couldn't save the results.");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <Link to={`/quizzes/${id}`} className="inline-flex items-center gap-1 text-sm text-blue-700 dark:text-blue-300"><ArrowLeft className="h-4 w-4" /> Back to the quiz</Link>
        <p className="mt-4 rounded-xl bg-rose-50 p-4 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" role="alert">{error}</p>
      </div>
    );
  }
  if (!spec) return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Preparing the answer sheets…</div>;
  const printable = students.filter((s) => chosen.has(s.id));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="paper-screen-only space-y-4">
        <Link to={`/quizzes/${id}`} className="inline-flex items-center gap-1 text-sm text-blue-700 dark:text-blue-300"><ArrowLeft className="h-4 w-4" /> Back to the quiz</Link>
        <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paper answer sheets</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {spec.title}: {spec.questions.length} question{spec.questions.length === 1 ? "" : "s"} on the sheet
            {spec.manual.length ? `; questions ${spec.manual.join(", ")} are marked by hand` : ""}.
            {spec.questions.length > CAPACITY ? ` Only the first ${CAPACITY} fit on a sheet.` : ""}
          </p>
        </header>
        <div className="flex gap-1" role="tablist">
          {(["print", "scan"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
              {t === "print" ? <Printer className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
              {t === "print" ? "1. Print" : "2. Scan and save"}
            </button>
          ))}
        </div>
      </div>

      {tab === "print" ? (
        <>
          <section className="paper-screen-only rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">{printable.length} of {students.length} students</p>
              <button type="button" className="text-sm font-semibold text-blue-700 underline dark:text-blue-300" onClick={() => setChosen(new Set(chosen.size === students.length ? [] : students.map((s) => s.id)))}>
                {chosen.size === students.length ? "Clear all" : "Select all"}
              </button>
              <button type="button" onClick={() => window.print()} disabled={!printable.length}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Printer className="h-4 w-4" /> Print {printable.length} sheet{printable.length === 1 ? "" : "s"}
              </button>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                    <input type="checkbox" checked={chosen.has(s.id)} onChange={(e) => setChosen((c) => { const n = new Set(c); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                    {s.name}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Print at 100% (no "fit to page"), one sided. Each sheet carries the student's QR code, so sheets can be handed in in any order.</p>
          </section>
          <div className="paper-print">
            {printable.map((s) => <Sheet key={s.id} spec={spec} student={s} quizTitle={spec.title} />)}
          </div>
        </>
      ) : (
        <section className="paper-screen-only space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              <Camera className="h-4 w-4" /> {busy ? "Reading…" : "Add photos or scans"}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="sr-only" data-testid="paper-files" disabled={busy} onChange={(e) => void scan(e.target.files)} />
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-300">Photograph each sheet flat, from above, with all four corner squares in the picture.</p>
            {good.length > 0 && (
              <button type="button" onClick={() => void save()} disabled={busy}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Save className="h-4 w-4" /> Save {good.length} result{good.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
          {sheets.length > 0 && (
            <p className="text-sm text-slate-700 dark:text-slate-200" data-testid="paper-summary">
              {good.length} sheet{good.length === 1 ? "" : "s"} read{toCheck ? `, ${toCheck} answer${toCheck === 1 ? "" : "s"} to check (highlighted)` : ""}
              {sheets.length - good.length ? `, ${sheets.length - good.length} couldn't be used` : ""}.
            </p>
          )}
          {saved && (
            <ul className="rounded-2xl bg-emerald-50 p-4 text-sm dark:bg-emerald-500/10" data-testid="paper-saved">
              {saved.map((r) => (
                <li key={r.studentId} className="text-slate-800 dark:text-slate-100">
                  {r.ok ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" /> : <FileWarning className="mr-1 inline h-4 w-4 text-rose-600" />}
                  {nameOf.get(r.studentId) ?? `Student ${r.studentId}`}: {r.ok ? `${r.score} / ${r.maxScore} (${r.percentage}%)${r.updated ? ", updated" : ""}` : r.message}
                </li>
              ))}
            </ul>
          )}
          {sheets.map((s, si) => (
            <article key={`${s.file}-${si}`} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700" data-testid="paper-review">
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <strong className="text-slate-900 dark:text-white">{s.result.studentId ? nameOf.get(s.result.studentId) ?? `Student ${s.result.studentId}` : s.file}</strong>
                {s.problem ? <span className="text-sm text-rose-700 dark:text-rose-300">{s.problem}</span> : <span className="text-xs text-slate-500 dark:text-slate-400">{s.file}</span>}
              </header>
              {!s.problem && (
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {(s.result.answers ?? []).map((a) => {
                    const q = spec.questions.find((x) => x.id === a.id)!;
                    const picks = s.picks[a.id] ?? [];
                    return (
                      <div key={a.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${STATUS_STYLE[a.status]}`} data-q={a.id} data-status={a.status}>
                        <span className="w-6 text-right text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{a.number}</span>
                        {bubbleLabels(q).map((label, k) => (
                          <button key={k} type="button" aria-pressed={picks.includes(k)} aria-label={`Question ${a.number} ${label}`}
                            onClick={() => toggle(si, a.id, k, q.type === "multiple_choice")}
                            className={`h-6 w-6 rounded-full border text-[10px] font-bold ${picks.includes(k) ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-300"}`}>
                            {label}
                          </button>
                        ))}
                        {a.status !== "ok" && <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">{STATUS_LABEL[a.status]}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default PaperSheetsPage;
