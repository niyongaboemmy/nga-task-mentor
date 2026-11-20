import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Settings2,
  Trash2,
  X,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { toast } from "react-toastify";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import Select from "../components/ui/Select";
import { CourseApiService } from "../services/courseApi";
import type { GradeBand } from "../services/reportCardApi";
import {
  NGA_BANDS,
  ReportCardWorkflowApi,
  apiMessage,
  type ReportCardScheme,
} from "../services/reportCardWorkflowApi";

/**
 * School report card settings (REPORT_CARDS_APPROVE): the grading scale
 * (PUT /settings/grading) and the scheme — weights, pass mark, behaviour
 * attributes, subject groups and what the card shows (PUT /report-cards/scheme).
 * The checks here mirror the server's (services/tenantSettings.ts).
 */

type Category = "CW" | "HW" | "MD" | "EOT";
const CATEGORIES: Array<{ key: Category; label: string }> = [
  { key: "CW", label: "Class work" },
  { key: "HW", label: "Home work" },
  { key: "MD", label: "Mid-term" },
  { key: "EOT", label: "End of term" },
];

interface BandRow {
  key: number;
  min: string;
  letter: string;
  remark: string;
}

interface SchemeForm {
  weights: Record<Category, string>;
  /** Term 3 integrated assessment weight (extra, outside the 100). */
  ia: string;
  pass_mark: string;
  attributes: Array<{ key: number; name: string }>;
  groups: Array<{ key: number; name: string; subject_ids: number[] }>;
  show_position: boolean;
  show_class_average: boolean;
  show_subject_teacher: boolean;
  head_title: string;
  require_distinct_approver: boolean;
  show_subject_rank: boolean;
  show_competence: boolean;
  thresholds: { specific: string; general: string; complementary: string };
}

interface SubjectOption {
  id: number;
  name: string;
}

let nextKey = 1;
const key = () => nextKey++;

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

// ─── Validation (mirrors the server) ─────────────────────────────────────────

/** Problems with the band rows; empty when the server will accept them. */
// eslint-disable-next-line react-refresh/only-export-components
export function validateBands(rows: Array<{ min: string; letter: string; remark: string }>): string[] {
  const errors: string[] = [];
  if (rows.length === 0) return ["Add at least one grade band."];
  if (rows.length > 20) errors.push("Use at most 20 grade bands.");
  const mins: number[] = [];
  rows.forEach((r, i) => {
    const n = i + 1;
    const min = num(r.min);
    if (!Number.isFinite(min) || min < 0 || min > 100) errors.push(`Row ${n}: the minimum must be between 0 and 100.`);
    else mins.push(min);
    const letter = r.letter.trim();
    if (!letter) errors.push(`Row ${n}: give a letter.`);
    else if (letter.length > 4) errors.push(`Row ${n}: the letter is at most 4 characters.`);
    if (r.remark.trim().length > 40) errors.push(`Row ${n}: the remark is at most 40 characters.`);
  });
  if (new Set(mins).size !== mins.length) errors.push("Each band needs a different minimum.");
  if (mins.length === rows.length && !mins.includes(0)) errors.push("One band must start at 0 so every score gets a grade.");
  return errors;
}

/** Problems with the scheme form; empty when the server will accept it. */
// eslint-disable-next-line react-refresh/only-export-components
export function validateScheme(f: SchemeForm): string[] {
  const errors: string[] = [];
  let sum = 0;
  for (const c of CATEGORIES) {
    const w = num(f.weights[c.key]);
    if (!Number.isFinite(w) || w < 0 || w > 100) errors.push(`The ${c.key} weight must be between 0 and 100.`);
    else sum += w;
  }
  if (errors.length === 0 && Math.abs(sum - 100) > 0.001) errors.push(`Category weights must add up to 100 (they add up to ${sum}).`);
  const ia = num(f.ia);
  if (!Number.isFinite(ia) || ia < 0 || ia > 100) errors.push("The IA weight must be between 0 and 100.");
  const pass = num(f.pass_mark);
  if (!Number.isFinite(pass) || pass < 0 || pass > 100) errors.push("The pass mark must be between 0 and 100.");
  const names = f.attributes.map((a) => a.name.trim());
  if (names.some((n) => !n)) errors.push("Every behaviour attribute needs a name (or remove the empty one).");
  const filled = names.filter(Boolean);
  if (filled.length === 0 || filled.length > 16) errors.push("Give between 1 and 16 behaviour attributes.");
  if (filled.some((n) => n.length > 100)) errors.push("Attribute names are at most 100 characters.");
  if (new Set(filled.map((n) => n.toLowerCase())).size !== filled.length) errors.push("Attribute names must be different from each other.");
  if (f.groups.length > 10) errors.push("Use at most 10 subject groups.");
  f.groups.forEach((g, i) => {
    const name = g.name.trim();
    if (!name || name.length > 60) errors.push(`Subject group ${i + 1} needs a name of at most 60 characters.`);
  });
  if (f.head_title.trim().length > 60) errors.push("The head of school title is at most 60 characters.");
  for (const k of ["specific", "general", "complementary"] as const) {
    const t = num(f.thresholds[k]);
    if (!Number.isFinite(t) || t < 0 || t > 100) errors.push(`The competence mark for ${k} modules must be between 0 and 100.`);
  }
  return errors;
}

const toForm = (s: ReportCardScheme): SchemeForm => ({
  weights: {
    CW: String(s.category_weights?.CW ?? 0),
    HW: String(s.category_weights?.HW ?? 0),
    MD: String(s.category_weights?.MD ?? 0),
    EOT: String(s.category_weights?.EOT ?? 0),
  },
  ia: String((s.category_weights as Record<string, number> | undefined)?.IA ?? 50),
  pass_mark: String(s.pass_mark ?? 50),
  attributes: (s.attributes ?? []).map((name) => ({ key: key(), name })),
  groups: (s.subject_groups ?? []).map((g) => ({ key: key(), name: g.name, subject_ids: [...(g.subject_ids ?? [])] })),
  show_position: !!s.show_position,
  show_class_average: !!s.show_class_average,
  show_subject_teacher: !!s.show_subject_teacher,
  head_title: s.head_title ?? "",
  require_distinct_approver: !!s.require_distinct_approver,
  show_subject_rank: s.show_subject_rank !== false,
  show_competence: s.show_competence !== false,
  thresholds: {
    specific: String(s.competence_thresholds?.specific ?? 70),
    general: String(s.competence_thresholds?.general ?? 50),
    complementary: String(s.competence_thresholds?.complementary ?? 50),
  },
});

const fromForm = (f: SchemeForm): ReportCardScheme => ({
  category_weights: { CW: num(f.weights.CW), HW: num(f.weights.HW), MD: num(f.weights.MD), EOT: num(f.weights.EOT), IA: num(f.ia) },
  pass_mark: num(f.pass_mark),
  attributes: f.attributes.map((a) => a.name.trim()).filter(Boolean),
  subject_groups: f.groups.map((g) => ({ name: g.name.trim(), subject_ids: g.subject_ids })),
  show_position: f.show_position,
  show_class_average: f.show_class_average,
  show_subject_teacher: f.show_subject_teacher,
  head_title: f.head_title.trim(),
  require_distinct_approver: f.require_distinct_approver,
  show_subject_rank: f.show_subject_rank,
  show_competence: f.show_competence,
  competence_thresholds: { specific: num(f.thresholds.specific), general: num(f.thresholds.general), complementary: num(f.thresholds.complementary) },
});

const toBandRows = (bands: GradeBand[]): BandRow[] =>
  [...bands].sort((a, b) => b.min - a.min).map((b) => ({ key: key(), min: String(b.min), letter: b.letter, remark: b.remark ?? "" }));

// ─── Small parts ─────────────────────────────────────────────────────────────

const INPUT =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-text-primary-light placeholder-slate-400 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-white/80 dark:placeholder-white/25";
const ICON_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-text-secondary-light transition-colors hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-text-secondary-light dark:border-white/10 dark:text-text-secondary-dark dark:hover:text-blue-300";
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-text-primary-light transition-colors hover:border-blue-300 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-text-primary-dark";
const PRIMARY_BTN =
  "inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40";

function Section({ id, title, hint, children, footer }: { id: string; title: string; hint?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 md:p-5">
      <h2 id={id} className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">{hint}</p>}
      <div className="mt-4">{children}</div>
      {footer && <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/5">{footer}</div>}
    </section>
  );
}

function Errors({ items, testId }: { items: string[]; testId: string }) {
  if (!items.length) return null;
  return (
    <ul data-testid={testId} className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
      {items.map((e) => (
        <li key={e} className="flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          {e}
        </li>
      ))}
    </ul>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{label}</p>
        {hint && <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
          checked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200 dark:border-white/15 dark:bg-white/10"
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function SaveBar({ saving, disabled, dirty, onSave, label, testId }: { saving: boolean; disabled: boolean; dirty: boolean; onSave: () => void; label: string; testId: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {!dirty && !saving && (
        <span className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> No unsaved changes
        </span>
      )}
      <button type="button" onClick={onSave} disabled={saving || disabled || !dirty} data-testid={testId} className={PRIMARY_BTN}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" data-testid="settings-skeleton">
      {[5, 2, 4, 3].map((rows, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: rows }, (_, j) => (
              <Skeleton key={j} className="h-9 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ReportCardSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [bands, setBands] = useState<BandRow[]>([]);
  const savedBands = useRef("");
  const [savingBands, setSavingBands] = useState(false);

  const [form, setForm] = useState<SchemeForm | null>(null);
  const savedScheme = useRef("");
  const [savingScheme, setSavingScheme] = useState(false);

  const [subjects, setSubjects] = useState<SubjectOption[] | null>(null);
  const [subjectsState, setSubjectsState] = useState<"loading" | "ready" | "failed">("loading");
  const [manualIds, setManualIds] = useState<Record<number, string>>({});

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    ReportCardWorkflowApi.scheme()
      .then((res) => {
        if (!live) return;
        const rows = toBandRows(res.data.bands ?? []);
        const f = toForm(res.data.scheme);
        setBands(rows);
        savedBands.current = JSON.stringify(rows.map(({ min, letter, remark }) => [min, letter, remark]));
        setForm(f);
        savedScheme.current = JSON.stringify(fromForm(f));
        setManualIds(Object.fromEntries(f.groups.map((g) => [g.key, g.subject_ids.join(", ")])));
      })
      .catch((e) => {
        if (!live) return;
        const msg = apiMessage(e, "Couldn't load the report card settings.");
        setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [reload]);

  useEffect(() => {
    let live = true;
    setSubjectsState("loading");
    CourseApiService.getCourses()
      .then((res) => {
        if (!live) return;
        const list = (res.data ?? [])
          .map((c) => ({ id: Number(c.id), name: c.code ? `${c.title} (${c.code})` : c.title }))
          .filter((s) => Number.isInteger(s.id) && s.id > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
        setSubjects(list);
        setSubjectsState(list.length ? "ready" : "failed");
      })
      .catch(() => live && setSubjectsState("failed"));
    return () => {
      live = false;
    };
  }, []);

  const subjectName = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s.name])), [subjects]);

  // ── Bands ──
  const bandErrors = useMemo(() => validateBands(bands), [bands]);
  const bandsDirty = JSON.stringify(bands.map(({ min, letter, remark }) => [min, letter, remark])) !== savedBands.current;
  const setBand = (k: number, patch: Partial<BandRow>) => setBands((rows) => rows.map((r) => (r.key === k ? { ...r, ...patch } : r)));

  const saveBands = async () => {
    if (bandErrors.length) {
      toast.error(bandErrors[0]);
      return;
    }
    setSavingBands(true);
    try {
      const res = await ReportCardWorkflowApi.saveBands(
        bands.map((b) => ({ min: num(b.min), letter: b.letter.trim(), remark: b.remark.trim() })),
      );
      const rows = toBandRows(res.bands ?? []);
      if (rows.length) setBands(rows);
      savedBands.current = JSON.stringify((rows.length ? rows : bands).map(({ min, letter, remark }) => [min, letter, remark]));
      toast.success("Grading scale saved.");
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't save the grading scale."));
    } finally {
      setSavingBands(false);
    }
  };

  // ── Scheme ──
  const schemeErrors = useMemo(() => (form ? validateScheme(form) : []), [form]);
  const schemeDirty = !!form && JSON.stringify(fromForm(form)) !== savedScheme.current;
  const patch = (p: Partial<SchemeForm>) => setForm((f) => (f ? { ...f, ...p } : f));
  const weightSum = form
    ? CATEGORIES.reduce((s, c) => s + (Number.isFinite(num(form.weights[c.key])) ? num(form.weights[c.key]) : 0), 0)
    : 0;

  const moveAttribute = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      if (!f) return f;
      const list = [...f.attributes];
      const j = i + dir;
      if (j < 0 || j >= list.length) return f;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...f, attributes: list };
    });

  const assigned = useMemo(() => new Set((form?.groups ?? []).flatMap((g) => g.subject_ids)), [form]);
  const setGroup = (k: number, p: Partial<SchemeForm["groups"][number]>) =>
    setForm((f) => (f ? { ...f, groups: f.groups.map((g) => (g.key === k ? { ...g, ...p } : g)) } : f));

  const saveScheme = async () => {
    if (!form) return;
    if (schemeErrors.length) {
      toast.error(schemeErrors[0]);
      return;
    }
    setSavingScheme(true);
    try {
      const res = await ReportCardWorkflowApi.saveScheme(fromForm(form));
      const f = res?.data?.scheme ? toForm(res.data.scheme) : form;
      setForm(f);
      savedScheme.current = JSON.stringify(fromForm(f));
      setManualIds(Object.fromEntries(f.groups.map((g) => [g.key, g.subject_ids.join(", ")])));
      toast.success("Report card settings saved.");
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't save the report card settings."));
    } finally {
      setSavingScheme(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <PageHeader
        breadcrumb={[{ label: "Report cards", to: "/report-cards" }, { label: "Settings" }]}
        icon={<Settings2 className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden />}
        title="Report card settings"
        description="The grading scale, how subject totals are weighted, and what every card in the school shows."
      />

      {loading ? (
        <PageSkeleton />
      ) : loadError || !form ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/5">
          <AlertCircle className="h-8 w-8 text-red-500" aria-hidden />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{loadError ?? "Couldn't load the report card settings."}</p>
          <button type="button" onClick={() => setReload((n) => n + 1)} className={GHOST_BTN}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      ) : (
        <>
          {/* 1. Grading scale */}
          <Section
            id="rc-bands"
            title="Grading scale"
            hint="A score gets the letter of the highest band whose minimum it reaches. One band must start at 0."
            footer={<SaveBar saving={savingBands} disabled={bandErrors.length > 0} dirty={bandsDirty} onSave={() => void saveBands()} label="Save grading scale" testId="save-bands" />}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setBands(toBandRows(NGA_BANDS))} className={GHOST_BTN} data-testid="nga-preset">
                Use NGA scale (A*–U)
              </button>
              <button
                type="button"
                onClick={() => setBands((rows) => [...rows, { key: key(), min: "", letter: "", remark: "" }])}
                disabled={bands.length >= 20}
                className={GHOST_BTN}
              >
                <Plus className="h-4 w-4" aria-hidden /> Add band
              </button>
            </div>
            <div className="hidden grid-cols-[5.5rem_5rem_1fr_2rem] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60 sm:grid">
              <span>Min %</span>
              <span>Letter</span>
              <span>Remark</span>
              <span />
            </div>
            <ul className="space-y-2" data-testid="band-rows">
              {bands.map((b, i) => (
                <li key={b.key} className="grid grid-cols-[4.5rem_4.5rem_1fr_2rem] items-center gap-2 sm:grid-cols-[5.5rem_5rem_1fr_2rem]">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={b.min}
                    onChange={(e) => setBand(b.key, { min: e.target.value })}
                    aria-label={`Band ${i + 1} minimum percent`}
                    className={`${INPUT} w-full`}
                  />
                  <input
                    value={b.letter}
                    maxLength={8}
                    onChange={(e) => setBand(b.key, { letter: e.target.value })}
                    aria-label={`Band ${i + 1} letter`}
                    className={`${INPUT} w-full`}
                  />
                  <input
                    value={b.remark}
                    onChange={(e) => setBand(b.key, { remark: e.target.value })}
                    aria-label={`Band ${i + 1} remark`}
                    placeholder="Remark"
                    className={`${INPUT} w-full min-w-0`}
                  />
                  <button
                    type="button"
                    onClick={() => setBands((rows) => rows.filter((r) => r.key !== b.key))}
                    disabled={bands.length <= 1}
                    aria-label={`Remove band ${i + 1}`}
                    className={ICON_BTN}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Errors items={bandErrors} testId="band-errors" />
            </div>
          </Section>

          {/* 2. Weights + pass mark */}
          <Section
            id="rc-weights"
            title="Category weights and pass mark"
            hint="How much each kind of assessment counts towards a subject total. The four must add up to 100."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CATEGORIES.map((c) => (
                <label key={c.key} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/80">
                    {c.key} <span className="font-normal">· {c.label}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={form.weights[c.key]}
                    onChange={(e) => patch({ weights: { ...form.weights, [c.key]: e.target.value } })}
                    aria-label={`${c.key} weight`}
                    className={`${INPUT} w-full`}
                  />
                </label>
              ))}
            </div>
            <p
              data-testid="weight-total"
              className={`mt-3 text-sm font-semibold tabular-nums ${Math.abs(weightSum - 100) < 0.001 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
            >
              Total: {weightSum} / 100
            </p>
            <label className="mt-4 flex max-w-[16rem] flex-col gap-1">
              <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/80">
                IA <span className="font-normal">· Integrated assessment (Term 3)</span>
              </span>
              <input
                type="number"
                min={0}
                max={100}
                inputMode="decimal"
                value={form.ia}
                onChange={(e) => patch({ ia: e.target.value })}
                aria-label="IA weight"
                className={`${INPUT} w-full`}
              />
              <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                Extra to the 100: a Term 3 mark is over FA (CW+HW+MD), IA and CA (EOT) together.
              </span>
            </label>
            <label className="mt-4 flex max-w-[12rem] flex-col gap-1">
              <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/80">Pass mark (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                inputMode="decimal"
                value={form.pass_mark}
                onChange={(e) => patch({ pass_mark: e.target.value })}
                aria-label="Pass mark"
                className={`${INPUT} w-full`}
              />
            </label>
          </Section>

          {/* Competence (RTB) */}
          <Section
            id="rc-competence"
            title="Competence (RTB)"
            hint="Each module is Competent when its mark (out of 100) reaches the threshold for its category, otherwise Not Yet Competent (NYC). RTB: competent from 70% of the module score; general and complementary modules commonly pass at 50%."
          >
            <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  ["specific", "Specific modules"],
                  ["general", "General modules"],
                  ["complementary", "Complementary modules"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/80">{label} (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={form.thresholds[k]}
                    onChange={(e) => patch({ thresholds: { ...form.thresholds, [k]: e.target.value } })}
                    aria-label={`Competence mark for ${label}`}
                    className={`${INPUT} w-full`}
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              A module's category comes from its subject group above (named Specific / General / Complementary) or, by default, its MIS code: CCM… complementary, GEN… general, other trade codes specific.
            </p>
          </Section>

          {/* 3. Attributes */}
          <Section
            id="rc-attributes"
            title="Behaviour attributes"
            hint="What class teachers rate on every card (Excellent / Very good / Good), in this order. 1 to 16."
          >
            <ol className="space-y-2" data-testid="attribute-rows">
              {form.attributes.map((a, i) => (
                <li key={a.key} className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark/60">{i + 1}.</span>
                  <input
                    value={a.name}
                    onChange={(e) =>
                      patch({ attributes: form.attributes.map((x) => (x.key === a.key ? { ...x, name: e.target.value } : x)) })
                    }
                    aria-label={`Attribute ${i + 1}`}
                    className={`${INPUT} min-w-0 flex-1`}
                  />
                  <button type="button" onClick={() => moveAttribute(i, -1)} disabled={i === 0} aria-label={`Move ${a.name || "attribute"} up`} className={ICON_BTN}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAttribute(i, 1)}
                    disabled={i === form.attributes.length - 1}
                    aria-label={`Move ${a.name || "attribute"} down`}
                    className={ICON_BTN}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ attributes: form.attributes.filter((x) => x.key !== a.key) })}
                    disabled={form.attributes.length <= 1}
                    aria-label={`Remove ${a.name || "attribute"}`}
                    className={ICON_BTN}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => patch({ attributes: [...form.attributes, { key: key(), name: "" }] })}
              disabled={form.attributes.length >= 16}
              className={`${GHOST_BTN} mt-3`}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add attribute
            </button>
          </Section>

          {/* 4. Subject groups */}
          <Section
            id="rc-groups"
            title="Subject groups"
            hint='Headings on the card, e.g. "Core modules" and "Specific modules". A subject sits in one group at most; ungrouped subjects are listed after them.'
          >
            {subjectsState === "loading" && (
              <div className="mb-3 space-y-2" data-testid="subjects-loading">
                <Skeleton className="h-3 w-48" />
              </div>
            )}
            {subjectsState === "failed" && (
              <p className="mb-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Couldn't load the subject list. Type subject ids instead, separated by commas.
              </p>
            )}
            {form.groups.length === 0 && (
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">No groups: subjects are listed in one block.</p>
            )}
            <ul className="space-y-3">
              {form.groups.map((g, i) => {
                const options = (subjects ?? []).filter((s) => !assigned.has(s.id));
                return (
                  <li key={g.key} className="rounded-xl border border-slate-200 p-3 dark:border-white/10" data-testid={`group-${i}`}>
                    <div className="flex items-center gap-2">
                      <input
                        value={g.name}
                        onChange={(e) => setGroup(g.key, { name: e.target.value })}
                        placeholder="Group name"
                        aria-label={`Group ${i + 1} name`}
                        className={`${INPUT} min-w-0 flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => patch({ groups: form.groups.filter((x) => x.key !== g.key) })}
                        aria-label={`Remove group ${g.name || i + 1}`}
                        className={ICON_BTN}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    {subjectsState === "failed" ? (
                      <input
                        value={manualIds[g.key] ?? ""}
                        onChange={(e) => {
                          const text = e.target.value;
                          setManualIds((m) => ({ ...m, [g.key]: text }));
                          const others = new Set(form.groups.filter((x) => x.key !== g.key).flatMap((x) => x.subject_ids));
                          const ids = [...new Set(text.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && !others.has(n)))];
                          setGroup(g.key, { subject_ids: ids });
                        }}
                        placeholder="Subject ids, e.g. 12, 15, 31"
                        aria-label={`Group ${i + 1} subject ids`}
                        className={`${INPUT} mt-2 w-full`}
                      />
                    ) : (
                      <>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {g.subject_ids.length === 0 && (
                            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">No subjects yet.</span>
                          )}
                          {g.subject_ids.map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200"
                            >
                              {subjectName.get(id) ?? `Subject #${id}`}
                              <button
                                type="button"
                                onClick={() => setGroup(g.key, { subject_ids: g.subject_ids.filter((x) => x !== id) })}
                                aria-label={`Remove ${subjectName.get(id) ?? `subject ${id}`} from ${g.name || "the group"}`}
                                className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                              >
                                <X className="h-3 w-3" aria-hidden />
                              </button>
                            </span>
                          ))}
                        </div>
                        {subjectsState === "ready" && (
                          <div className="mt-2 max-w-xs">
                            <Select
                              size="sm"
                              variant="outline"
                              value=""
                              onValueChange={(v) => {
                                const id = Number(v);
                                if (id) setGroup(g.key, { subject_ids: [...g.subject_ids, id] });
                              }}
                              disabled={options.length === 0}
                              aria-label={`Add a subject to group ${i + 1}`}
                            >
                              <option value="">{options.length ? "Add subject…" : "Every subject is grouped"}</option>
                              {options.map((s) => (
                                <option key={s.id} value={String(s.id)}>
                                  {s.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => patch({ groups: [...form.groups, { key: key(), name: "", subject_ids: [] }] })}
              disabled={form.groups.length >= 10}
              className={`${GHOST_BTN} mt-3`}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add group
            </button>
          </Section>

          {/* 5. Card display */}
          <Section id="rc-display" title="Card display and approval">
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              <Toggle
                label="Show class average"
                hint="Each subject's class average beside the student's total."
                checked={form.show_class_average}
                onChange={(v) => patch({ show_class_average: v })}
              />
              <Toggle
                label="Show subject teacher"
                hint="The teacher's name on each subject row."
                checked={form.show_subject_teacher}
                onChange={(v) => patch({ show_subject_teacher: v })}
              />
              <Toggle
                label="Show position in class"
                hint='E.g. "5th of 32".'
                checked={form.show_position}
                onChange={(v) => patch({ show_position: v })}
              />
              <Toggle
                label="Show each module's position in class"
                hint='E.g. "3/18" beside the module mark.'
                checked={form.show_subject_rank}
                onChange={(v) => patch({ show_subject_rank: v })}
              />
              <Toggle
                label="Show Competent / NYC decision"
                hint="The RTB competence decision for each module."
                checked={form.show_competence}
                onChange={(v) => patch({ show_competence: v })}
              />
              <Toggle
                label="Approver must differ from reviewer"
                hint="Four-eyes: whoever marked a card reviewed can't approve it too."
                checked={form.require_distinct_approver}
                onChange={(v) => patch({ require_distinct_approver: v })}
              />
            </div>
            <label className="mt-4 flex max-w-sm flex-col gap-1">
              <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/80">Head of school title</span>
              <input
                value={form.head_title}
                onChange={(e) => patch({ head_title: e.target.value })}
                placeholder="Principal"
                aria-label="Head of school title"
                className={`${INPUT} w-full`}
              />
              <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">Used for the head's comment and signature line.</span>
            </label>
          </Section>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 md:p-5">
            <Errors items={schemeErrors} testId="scheme-errors" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to="/report-cards" className="text-sm text-blue-600 hover:underline dark:text-blue-300">
                Back to report cards
              </Link>
              <SaveBar
                saving={savingScheme}
                disabled={schemeErrors.length > 0}
                dirty={schemeDirty}
                onSave={() => void saveScheme()}
                label="Save report card settings"
                testId="save-scheme"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
