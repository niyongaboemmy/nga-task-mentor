import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  EMPTY,
  changedIds,
  clearDraft,
  isRecorded,
  parsePaste,
  readDraft,
  savePayload,
  writeDraft,
  type MarkBook,
  type MarkEntry,
  type MarkStatus,
} from "./marksEntry";
import { motion } from "framer-motion";
import {
  Loader2,
  Users,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  Zap,
  Eraser,
  Save,
  TrendingUp,
  Trophy,
  Clock,
  UserX,
  ShieldMinus,
  RotateCcw,
  ClipboardPaste,
  Keyboard,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../../services/manualAssessmentApi";
import Tooltip from "../ui/Tooltip";
import ConfirmDialog from "../ui/ConfirmDialog";

export interface StudentEntry {
  student_id: number;
  name: string;
  /** Shown next to the name when supplied (full-page marks entry has it; the
   * report-card builder's roster does not). */
  reg_number?: string;
}

// Deterministic solid avatar color per student — no gradients.
const AVATAR_COLORS = ["bg-blue-600", "bg-blue-700", "bg-gray-500", "bg-orange-500", "bg-gray-600", "bg-blue-500"];

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border-light dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/[0.08]" />
        <div className="h-2.5 w-16 rounded bg-gray-200 dark:bg-white/[0.06]" />
      </div>
      <div className="w-20 h-8 rounded-lg bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
    </div>
  );
}

// Compact number summary chip for the header KPI row — deliberately tiny
// (icon + short label + value) so four of them fit on one line without
// pushing the header's height up.
function KpiChip({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "blue" | "orange" | "neutral";
}) {
  const toneClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
    orange: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/40",
    neutral: "bg-gray-50 dark:bg-white/[0.04] text-text-secondary-light dark:text-slate-300 border-gray-200 dark:border-white/[0.08]",
  }[tone];
  return (
    <div className={`flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-lg border text-[10.5px] leading-none ${toneClasses}`}>
      {icon}
      <span className="opacity-70 font-medium">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export type MarksFilter = "all" | "todo" | "marked" | "status" | "unsaved";

export interface ManualScoreEntryProps {
  assessment: ManualAssessment;
  students: StudentEntry[];
  /** Shows a "Back" link above the title — used when this is a step in a
   * multi-step flow (the modal's create → scores handoff). */
  onBack?: () => void;
  /** Shows a "Cancel" button in the footer (asks first when marks are unsaved). */
  onCancel?: () => void;
  /** Called after a successful save with how many marks were saved. Whether
   * to navigate away afterward is entirely the caller's call — this
   * component never closes/navigates on its own. */
  onSaved?: (count: number) => void;
  /** How many rows are unsaved, whenever it changes (pages guard leaving with it). */
  onDirtyChange?: (unsaved: number) => void;
  /** The list filter to open with (e.g. "todo" from a "3 missing" link). */
  initialFilter?: MarksFilter;
  /**
   * "modal": fills the height it's given and scrolls its own list
   * internally (for a fixed-height modal card).
   * "page": flows naturally with the page; the save bar stays pinned to the
   * viewport bottom via `sticky` as the page scrolls.
   */
  variant?: "modal" | "page";
}

const STATUS_META: Record<Exclude<MarkStatus, "scored">, { label: string; hint: string; cls: string; Icon: typeof UserX }> = {
  absent: {
    label: "Absent",
    hint: "Counts as 0 on the report card",
    cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30",
    Icon: UserX,
  },
  exempt: {
    label: "Exempt",
    hint: "Left out of the report card",
    cls: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/[0.12]",
    Icon: ShieldMinus,
  },
};

const fromServer = (rows: Array<{ student_id: number; score: number; status?: MarkStatus }>): MarkBook => {
  const book: MarkBook = {};
  for (const r of rows) {
    const status = r.status ?? "scored";
    book[r.student_id] = status === "scored" ? { score: String(Number(r.score)), status } : { score: "", status };
  }
  return book;
};

const agoLabel = (at: number) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(at).toLocaleDateString();
};

export default function ManualScoreEntry({
  assessment,
  students,
  onBack,
  onCancel,
  onSaved,
  onDirtyChange,
  initialFilter = "all",
  variant = "modal",
}: ManualScoreEntryProps) {
  const [book, setBook] = useState<MarkBook>({});
  const [saved, setSaved] = useState<MarkBook>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MarksFilter>(initialFilter);
  const [draft, setDraft] = useState<ReturnType<typeof readDraft>>(null);
  const [showKeys, setShowKeys] = useState(false);
  const inputRefs = useRef<Record<number, HTMLElement | null>>({});
  const maxScore = parseFloat(String(assessment.max_score));

  // Brief highlight on an input that was capped at the max, so the clamp
  // reads as deliberate instead of a silent rewrite of what was typed.
  const [flashId, setFlashId] = useState<number | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const flash = (id: number) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 900);
  };
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await ManualAssessmentApiService.getScores(assessment.id);
      const fromDb = fromServer(res.data ?? []);
      setSaved(fromDb);
      setBook(fromDb);
      // Unsaved marks from an earlier visit (closed tab, lost connection).
      const d = readDraft(assessment.id);
      setDraft(d && changedIds({ ...fromDb, ...d.entries }, fromDb).length ? d : null);
      if (d && !changedIds({ ...fromDb, ...d.entries }, fromDb).length) clearDraft(assessment.id);
    } catch {
      setLoadFailed(true);
      toast.error("Couldn't load the recorded marks.");
    } finally {
      setLoading(false);
    }
  }, [assessment.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const unsavedIds = useMemo(() => changedIds(book, saved), [book, saved]);
  const unsaved = unsavedIds.length;
  useEffect(() => onDirtyChange?.(unsaved), [unsaved, onDirtyChange]);

  // Keep unsaved rows as a local draft (restored on the next visit if not saved).
  useEffect(() => {
    if (loading || draft) return;
    const t = window.setTimeout(() => writeDraft(assessment.id, Object.fromEntries(unsavedIds.map((id) => [id, book[id] ?? EMPTY]))), 400);
    return () => window.clearTimeout(t);
  }, [book, unsavedIds, assessment.id, loading, draft]);

  const setEntry = useCallback((id: number, e: MarkEntry) => setBook((b) => ({ ...b, [id]: e })), []);

  const handleScoreChange = (id: number, raw: string) => {
    const clean = raw.replace(",", ".").replace(/[^0-9.]/g, "");
    if (clean === "") return setEntry(id, EMPTY);
    const n = Number(clean);
    if (Number.isFinite(n) && n > maxScore) {
      flash(id);
      return setEntry(id, { score: String(maxScore), status: "scored" });
    }
    setEntry(id, { score: clean, status: "scored" });
  };

  const setStatus = (id: number, status: MarkStatus) => {
    setEntry(id, status === "scored" ? EMPTY : { score: "", status });
    window.setTimeout(() => inputRefs.current[id]?.focus(), 0);
  };

  // ── Derived numbers ──
  const recordedCount = students.filter((s) => isRecorded(book[s.student_id])).length;
  const kpis = useMemo(() => {
    const vals = students
      .map((s) => book[s.student_id])
      .filter((e): e is MarkEntry => !!e && e.status === "scored" && e.score.trim() !== "")
      .map((e) => Number(e.score))
      .filter((n) => Number.isFinite(n));
    return {
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      high: vals.length ? Math.max(...vals) : null,
      absent: students.filter((s) => book[s.student_id]?.status === "absent").length,
      exempt: students.filter((s) => book[s.student_id]?.status === "exempt").length,
    };
  }, [book, students]);
  const left = students.length - recordedCount;

  const counts: Record<MarksFilter, number> = {
    all: students.length,
    todo: left,
    marked: students.filter((s) => book[s.student_id]?.status === "scored" && isRecorded(book[s.student_id])).length,
    status: kpis.absent + kpis.exempt,
    unsaved,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const unsavedSet = new Set(unsavedIds);
    return students.filter((s) => {
      const e = book[s.student_id];
      if (filter === "todo" && isRecorded(e)) return false;
      if (filter === "marked" && !(e?.status === "scored" && isRecorded(e))) return false;
      if (filter === "status" && !(e && e.status !== "scored")) return false;
      if (filter === "unsaved" && !unsavedSet.has(s.student_id)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || String(s.student_id).includes(q) || !!s.reg_number?.toLowerCase().includes(q);
    });
    // The filter is applied to the rows as they were when it was picked, so a
    // row doesn't vanish under the cursor the moment it's filled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, search, filter, loading]);

  const focusRow = useCallback(
    (fromId: number, step: 1 | -1) => {
      const i = visible.findIndex((s) => s.student_id === fromId);
      const next = visible[i + step];
      if (next) {
        const el = inputRefs.current[next.student_id];
        el?.focus();
        if (el instanceof HTMLInputElement) el.select();
      }
    },
    [visible],
  );

  // A column pasted from a spreadsheet fills this row and the ones below it.
  const handlePaste = (fromId: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (!/[\n\t]/.test(text.trim())) return; // a single value: let the input take it
    e.preventDefault();
    const cells = parsePaste(text, maxScore);
    const start = visible.findIndex((s) => s.student_id === fromId);
    const targets = visible.slice(start, start + cells.length);
    const updates: MarkBook = {};
    targets.forEach((s, i) => {
      const c = cells[i];
      if (c) updates[s.student_id] = c;
    });
    const filled = Object.keys(updates).length;
    const skipped = targets.length - filled;
    setBook((b) => ({ ...b, ...updates }));
    const over = Math.max(0, cells.length - targets.length);
    toast.success(
      `Pasted ${filled} mark${filled === 1 ? "" : "s"}${skipped ? `, ${skipped} unreadable left as they were` : ""}${over ? `; ${over} more than there are students below` : ""}. Review, then save.`,
    );
  };

  const handleSave = async () => {
    const { scores, kept, invalid } = savePayload(book, saved, maxScore);
    if (invalid.length) {
      const who = students.find((s) => s.student_id === invalid[0])?.name ?? `#${invalid[0]}`;
      toast.error(`${who}: the mark must be between 0 and ${maxScore}.`);
      return;
    }
    if (!scores.length) {
      toast.info(kept.length ? "A saved mark can't be removed; mark the student absent or exempt instead." : "Nothing to save: no marks changed.");
      if (kept.length) setBook((b) => ({ ...b, ...Object.fromEntries(kept.map((id) => [id, saved[id]])) }));
      return;
    }
    setSaving(true);
    try {
      await ManualAssessmentApiService.upsertScores(assessment.id, { scores });
      const merged = { ...book, ...Object.fromEntries(kept.map((id) => [id, saved[id]])) };
      setSaved(merged);
      setBook(merged);
      clearDraft(assessment.id);
      const abs = scores.filter((x) => x.status === "absent").length;
      const ex = scores.filter((x) => x.status === "exempt").length;
      const parts = [`${scores.length - abs - ex} mark${scores.length - abs - ex === 1 ? "" : "s"}`, abs ? `${abs} absent` : "", ex ? `${ex} exempt` : ""].filter(Boolean);
      toast.success(`Saved ${parts.join(", ")}.${kept.length ? ` ${kept.length} saved mark${kept.length === 1 ? " was" : "s were"} kept (marks can't be removed).` : ""}`);
      onSaved?.(scores.length);
    } catch (err) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Couldn't save the marks. They're kept here: try again.");
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S saves from anywhere in the list.
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving]);

  // Leaving the browser tab with unsaved marks asks first (the draft also keeps them).
  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  const fillRemainingWithMax = () => {
    const ids = students.filter((s) => !isRecorded(book[s.student_id])).map((s) => s.student_id);
    if (!ids.length) return toast.info("Every student already has a mark.");
    setBook((b) => ({ ...b, ...Object.fromEntries(ids.map((id) => [id, { score: String(maxScore), status: "scored" as const }])) }));
    toast.success(`Filled ${ids.length} empty mark${ids.length === 1 ? "" : "s"} with the maximum (${maxScore}).`);
  };

  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const undoAll = () => {
    setBook(saved);
    clearDraft(assessment.id);
    setConfirmUndoOpen(false);
    toast.success(`Undid ${unsaved} unsaved change${unsaved === 1 ? "" : "s"}.`);
  };

  const restoreDraft = () => {
    if (!draft) return;
    setBook((b) => ({ ...b, ...draft.entries }));
    const n = Object.keys(draft.entries).length;
    setDraft(null);
    toast.success(`Restored ${n} unsaved mark${n === 1 ? "" : "s"}. Save to keep them.`);
  };
  const discardDraft = () => {
    clearDraft(assessment.id);
    setDraft(null);
    toast.info("Discarded the unsaved marks from your last visit.");
  };

  const isPage = variant === "page";
  const filters: Array<[MarksFilter, string]> = [
    ["all", "All"],
    ["todo", "To mark"],
    ["marked", "Marked"],
    ["status", "Absent / exempt"],
    ["unsaved", "Unsaved"],
  ];
  const unsavedSet = new Set(unsavedIds);

  return (
    <div className={`flex flex-col ${isPage ? "" : "h-full min-h-0"}`} data-testid="marks-entry">
      {/* Header: title, KPI chips, progress, filters, search + quick actions */}
      <div className={`px-4 pt-3 pb-2.5 border-b border-border-light dark:border-white/[0.06] flex-shrink-0 space-y-2 ${isPage ? "rounded-t-2xl bg-white dark:bg-panel-dark" : ""}`}>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-slate-400 hover:text-text-primary-light dark:hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-text-primary-light dark:text-white truncate">{assessment.title}</h2>
          <span className="flex items-center gap-1 text-[11px] text-text-secondary-light dark:text-slate-400 flex-shrink-0">
            <Users className="w-3 h-3" />
            {students.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" data-testid="marks-kpis">
          <KpiChip icon={<CheckCircle2 className="w-3 h-3" />} label="Recorded" value={`${recordedCount}/${students.length}`} tone="blue" />
          <KpiChip icon={<TrendingUp className="w-3 h-3" />} label="Avg" value={kpis.avg != null ? kpis.avg.toFixed(1) : "—"} />
          <KpiChip icon={<Trophy className="w-3 h-3" />} label="High" value={kpis.high != null ? String(kpis.high) : "—"} />
          <KpiChip icon={<Clock className="w-3 h-3" />} label="Left" value={String(left)} tone={left > 0 ? "orange" : "blue"} />
          {kpis.absent + kpis.exempt > 0 && <KpiChip icon={<UserX className="w-3 h-3" />} label="Absent/exempt" value={`${kpis.absent}/${kpis.exempt}`} />}
        </div>

        <div className="w-full h-1 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: students.length > 0 ? `${(recordedCount / students.length) * 100}%` : "0%" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {draft && !loading && (
          <div role="status" data-testid="draft-banner" className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
            <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            <span className="flex-1 min-w-[12rem]">
              {Object.keys(draft.entries).length} unsaved mark{Object.keys(draft.entries).length === 1 ? "" : "s"} from {agoLabel(draft.at)} on this device.
            </span>
            <button type="button" onClick={restoreDraft} className="rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white hover:bg-blue-700">
              Restore
            </button>
            <button type="button" onClick={discardDraft} className="rounded-lg px-2.5 py-1 font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20">
              Discard
            </button>
          </div>
        )}

        <div role="tablist" aria-label="Show students" className="flex flex-wrap gap-1">
          {filters.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filter === k}
              data-testid={`marks-filter-${k}`}
              onClick={() => setFilter(k)}
              disabled={k !== "all" && counts[k] === 0 && filter !== k}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                filter === k
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-text-secondary-light hover:bg-gray-200 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1]"
              }`}
            >
              {label}
              <span className={`tabular-nums ${filter === k ? "text-white/80" : "opacity-70"}`}>{counts[k]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student…"
              aria-label="Search student"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-text-primary-light dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
            />
          </div>
          <button
            onClick={fillRemainingWithMax}
            title={`Fill every empty mark with the maximum (${maxScore})`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-all flex-shrink-0"
          >
            <Zap className="w-3 h-3" />
            Fill max
          </button>
          <Tooltip label="Keyboard and paste tips">
            <button
              type="button"
              onClick={() => setShowKeys((v) => !v)}
              aria-expanded={showKeys}
              aria-label="Keyboard and paste tips"
              className="flex items-center justify-center p-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-text-secondary-light dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all flex-shrink-0"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Undo every unsaved change">
            <button
              onClick={() => (unsaved ? setConfirmUndoOpen(true) : toast.info("No unsaved changes to undo."))}
              aria-label="Undo every unsaved change"
              className="flex items-center justify-center p-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-text-secondary-light dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-300 transition-all flex-shrink-0"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
        {showKeys && (
          <ul data-testid="marks-tips" className="grid gap-1 rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-text-secondary-light dark:bg-white/[0.04] dark:text-slate-300 sm:grid-cols-2">
            <li><kbd className="font-semibold">Enter</kbd> / <kbd className="font-semibold">↓</kbd> next student · <kbd className="font-semibold">Shift+Enter</kbd> / <kbd className="font-semibold">↑</kbd> previous</li>
            <li><kbd className="font-semibold">A</kbd> absent · <kbd className="font-semibold">E</kbd> exempt · <kbd className="font-semibold">Backspace</kbd> back to a mark</li>
            <li className="flex items-center gap-1"><ClipboardPaste className="h-3 w-3" /> Paste a column from Excel or Sheets into a row: it fills that row and those below (ABS / EX work too).</li>
            <li><kbd className="font-semibold">Ctrl/⌘+S</kbd> saves · unsaved marks are kept on this device until saved.</li>
          </ul>
        )}
      </div>

      {/* Students */}
      <div className={`px-4 py-3 space-y-2 ${isPage ? "bg-white dark:bg-panel-dark" : "flex-1 overflow-y-auto"}`}>
        {loading ? (
          <div className="space-y-2" data-testid="marks-skeleton">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : loadFailed ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-orange-400" />
            <p className="text-xs text-text-secondary-light dark:text-slate-400">The recorded marks didn't load, so nothing can be saved yet.</p>
            <button type="button" onClick={() => void load()} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold dark:border-white/[0.1]">
              Try again
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-8 h-8 text-gray-300 dark:text-slate-600" />
            <p className="text-xs text-text-secondary-light dark:text-slate-400">No students found in this course.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Search className="w-8 h-8 text-gray-300 dark:text-slate-600" />
            <p className="text-xs text-text-secondary-light dark:text-slate-400">{search ? `No students match "${search}".` : "No students in this view."}</p>
            {filter !== "all" && (
              <button type="button" onClick={() => setFilter("all")} className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Show all students
              </button>
            )}
          </div>
        ) : (
          visible.map((student, idx) => {
            const id = student.student_id;
            const e = book[id] ?? EMPTY;
            const status = e.status;
            const val = e.score;
            const num = Number(val);
            const isValid = val === "" || (Number.isFinite(num) && num >= 0 && num <= maxScore);
            const recorded = isRecorded(e);
            const dirty = unsavedSet.has(id);
            const color = AVATAR_COLORS[id % AVATAR_COLORS.length];
            const initials = student.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
            const keyNav = (ev: React.KeyboardEvent) => {
              if (ev.key === "Enter" || ev.key === "ArrowDown") {
                ev.preventDefault();
                focusRow(id, ev.key === "Enter" && ev.shiftKey ? -1 : 1);
              } else if (ev.key === "ArrowUp") {
                ev.preventDefault();
                focusRow(id, -1);
              }
            };
            return (
              <motion.div
                key={id}
                data-testid={`mark-row-${id}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx, 12) * 0.015 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                  !isValid
                    ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/30"
                    : recorded
                      ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30"
                      : "bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.06]"
                }`}
              >
                <div className={`relative w-9 h-9 rounded-xl ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {initials || "?"}
                  {dirty && (
                    <span
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500 dark:border-panel-dark"
                      title="Not saved yet"
                      data-testid={`unsaved-dot-${id}`}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary-light dark:text-slate-200 font-medium truncate">{student.name}</p>
                  <p className="text-[11px] text-text-secondary-light dark:text-slate-400">
                    {student.reg_number ? student.reg_number : `ID #${id}`}
                    {dirty && <span className="ml-1.5 font-semibold text-orange-600 dark:text-orange-300">· unsaved</span>}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {status === "scored" ? (
                    <div
                      className={`flex items-center rounded-xl border-2 overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500/40 ${
                        flashId === id
                          ? "border-orange-400 dark:border-orange-500/60 ring-2 ring-orange-500/30"
                          : !isValid
                            ? "border-orange-400 dark:border-orange-500/50"
                            : val !== ""
                              ? "border-blue-400 dark:border-blue-600/50"
                              : "border-gray-200 dark:border-white/[0.14] hover:border-gray-300 dark:hover:border-white/[0.22]"
                      }`}
                    >
                      <input
                        ref={(el) => {
                          inputRefs.current[id] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={val}
                        onChange={(ev) => handleScoreChange(id, ev.target.value)}
                        onPaste={(ev) => handlePaste(id, ev)}
                        onKeyDown={(ev) => {
                          const k = ev.key.toLowerCase();
                          if (!ev.metaKey && !ev.ctrlKey && (k === "a" || k === "e")) {
                            ev.preventDefault();
                            setStatus(id, k === "a" ? "absent" : "exempt");
                            return;
                          }
                          keyNav(ev);
                        }}
                        placeholder="–"
                        aria-label={`Mark for ${student.name}, out of ${maxScore}`}
                        className={`w-16 pl-3 pr-1.5 py-1.5 text-sm text-right font-mono bg-white dark:bg-white/[0.06] focus:outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500 ${
                          !isValid ? "text-orange-700 dark:text-orange-300" : "text-text-primary-light dark:text-white"
                        }`}
                      />
                      <span className="pr-2.5 pl-1 py-1.5 text-xs font-medium text-text-secondary-light dark:text-slate-300 bg-gray-50 dark:bg-white/[0.03] border-l border-gray-200 dark:border-white/[0.1]">
                        /{maxScore}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      ref={(el) => {
                        inputRefs.current[id] = el;
                      }}
                      data-testid={`status-pill-${id}`}
                      onClick={() => setStatus(id, "scored")}
                      onKeyDown={(ev) => {
                        if (ev.key === "Backspace" || ev.key === "Delete") {
                          ev.preventDefault();
                          setStatus(id, "scored");
                          return;
                        }
                        const k = ev.key.toLowerCase();
                        if (k === "a" || k === "e") {
                          ev.preventDefault();
                          setStatus(id, k === "a" ? "absent" : "exempt");
                          return;
                        }
                        keyNav(ev);
                      }}
                      title={`${STATUS_META[status].hint}. Click or press Backspace to enter a mark instead.`}
                      aria-label={`${student.name}: ${STATUS_META[status].label}. ${STATUS_META[status].hint}. Press Backspace to enter a mark.`}
                      className={`inline-flex h-[36px] w-[104px] items-center justify-center gap-1.5 rounded-xl border-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${STATUS_META[status].cls}`}
                    >
                      {(() => {
                        const I = STATUS_META[status].Icon;
                        return <I className="h-3.5 w-3.5" aria-hidden />;
                      })()}
                      {STATUS_META[status].label}
                    </button>
                  )}
                  <div className="flex items-center rounded-lg border border-gray-200 p-0.5 dark:border-white/[0.1]" role="group" aria-label={`Status for ${student.name}`}>
                    {(["absent", "exempt"] as const).map((st) => {
                      const I = STATUS_META[st].Icon;
                      const on = status === st;
                      return (
                        <Tooltip key={st} label={`${STATUS_META[st].label}: ${STATUS_META[st].hint.toLowerCase()} (${st === "absent" ? "A" : "E"})`}>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setStatus(id, on ? "scored" : st)}
                            aria-pressed={on}
                            aria-label={`Mark ${student.name} ${st}`}
                            data-testid={`${st}-${id}`}
                            className={`rounded-md p-1 transition-colors ${
                              on ? "bg-blue-600 text-white" : "text-text-secondary-light hover:bg-gray-100 hover:text-text-primary-light dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
                            }`}
                          >
                            <I className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Save bar: pinned within the modal, or stuck to the viewport bottom on a page */}
      <div
        className={`px-4 py-3 border-t border-border-light dark:border-white/[0.06] flex-shrink-0 bg-surface-light/90 dark:bg-panel-dark/90 backdrop-blur-sm ${isPage ? "sticky bottom-0 rounded-b-2xl" : ""}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="hidden min-w-0 flex-1 text-xs text-text-secondary-light dark:text-slate-400 sm:block" aria-live="polite" data-testid="save-status">
            {saving ? "Saving…" : unsaved ? (
              <span className="font-semibold text-orange-600 dark:text-orange-300">{unsaved} unsaved change{unsaved === 1 ? "" : "s"}</span>
            ) : loading ? "" : (
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> All changes saved</span>
            )}
          </span>
          {onCancel && (
            <button
              onClick={() => (unsaved ? setConfirmCancelOpen(true) : onCancel())}
              className="flex-1 sm:flex-none sm:px-5 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-text-secondary-light dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-all"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => void handleSave()}
            disabled={saving || loading || loadFailed || unsaved === 0}
            data-testid="save-marks"
            className="flex-1 sm:flex-none sm:px-6 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : unsaved ? `Save ${unsaved} change${unsaved === 1 ? "" : "s"}` : "Saved"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmUndoOpen}
        title="Undo every unsaved change?"
        description={`The ${unsaved} change${unsaved === 1 ? "" : "s"} you haven't saved go back to the saved marks. Saved marks stay as they are.`}
        confirmLabel="Undo changes"
        danger
        onConfirm={undoAll}
        onCancel={() => setConfirmUndoOpen(false)}
      />
      <ConfirmDialog
        open={confirmCancelOpen}
        title="Leave without saving?"
        description={`${unsaved} change${unsaved === 1 ? " isn't" : "s aren't"} saved. They stay on this device as a draft you can restore next time.`}
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          onCancel?.();
        }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
