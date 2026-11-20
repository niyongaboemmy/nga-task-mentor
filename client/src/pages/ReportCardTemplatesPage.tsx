import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, CheckCircle2, Eye, LayoutTemplate, Loader2, RotateCcw, Save, Search, Settings2, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import TemplateCanvas from "../components/ReportCard/templates/TemplateCanvas";
import TemplatePreviewModal from "../components/ReportCard/templates/TemplatePreviewModal";
import { sampleNormalDocument, sampleTvetDocument } from "../components/ReportCard/templates/sampleDocuments";
import { NORMAL_STRUCTURE, TVET_STRUCTURE, refreshReportCardStructure } from "../hooks/useReportCardStructure";
import type { ReportCardBuilderKind, ReportCardDocument } from "../services/reportCardApi";
import {
  DEFAULT_TVET_OPTIONS,
  ReportCardWorkflowApi,
  apiMessage,
  type ReportCardScheme,
  type TemplateModule,
  type TvetTemplateOptions,
} from "../services/reportCardWorkflowApi";

/**
 * Report card builders and templates (REPORT_CARDS_APPROVE): the school picks
 * the builder its teachers map marks into, Normal (CW/HW/MD/EOT) or TVET
 * (FA/CA/IA, RTB / CAMIS), each with its own card template. The page shows
 * both templates live with sample data, switches the builder with a
 * confirmation, and edits the TVET template's options: the school block the
 * CAMIS header prints, the qualification, and each module's weight (MIS
 * learning hours, overridable). The Normal template's options live on the
 * settings page.
 */

type Opts = TvetTemplateOptions;
const CATEGORY_LABEL: Record<string, string> = { specific: "Specific", general: "General", complementary: "Complementary" };

const INPUT =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary-light placeholder-gray-400 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:opacity-60 dark:border-panel-line dark:bg-panel-raised dark:text-text-primary-dark dark:placeholder-white/25";
const GHOST =
  "inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-text-primary-light transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 dark:border-panel-line dark:bg-panel-raised dark:text-text-primary-dark dark:hover:text-blue-300";
const PRIMARY =
  "inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";
const CARD = "rounded-3xl border border-gray-200 bg-white p-4 dark:border-panel-line dark:bg-panel-dark md:p-5";

/** Problems with the TVET options; empty when the server will accept them (mirrors normalizeTvetOptions). */
// eslint-disable-next-line react-refresh/only-export-components
export function validateTvetOptions(o: Opts, weights: Record<string, string>): string[] {
  const errors: string[] = [];
  const max: Array<[keyof Opts, number, string]> = [
    ["district", 60, "The district"],
    ["sector", 80, "The sector"],
    ["school_email", 120, "The school email"],
    ["school_phone", 40, "The school phone"],
    ["headmaster_name", 80, "The headmaster's name"],
    ["qualification_title", 120, "The qualification title"],
  ];
  for (const [k, n, label] of max) if (String(o[k] ?? "").trim().length > n) errors.push(`${label} is at most ${n} characters.`);
  if (!Number.isFinite(o.default_module_weight) || o.default_module_weight <= 0 || o.default_module_weight > 1000) errors.push("The default module weight must be between 1 and 1000.");
  const bad = Object.values(weights).filter((v) => v.trim() !== "" && (!Number.isFinite(Number(v)) || Number(v) <= 0 || Number(v) > 1000));
  if (bad.length) errors.push(`${bad.length} module weight${bad.length === 1 ? " is" : "s are"} not between 1 and 1000.`);
  return errors;
}

/** The sample card dressed with the options being edited (the live preview). */
function decorateTvet(doc: ReportCardDocument, o: Opts, schoolName?: string): ReportCardDocument {
  if (!doc.tvet) return doc;
  return {
    ...doc,
    school: schoolName ? { ...doc.school, name: schoolName } : doc.school,
    qualification: {
      ...(doc.qualification ?? { rqf_level: null, trade: null, title: null, sector: null }),
      title: o.qualification_title.trim() || doc.qualification?.title || null,
      sector: o.sector.trim() || null,
    },
    tvet: {
      ...doc.tvet,
      school: {
        district: o.district.trim(),
        email: o.school_email.trim(),
        phone: o.school_phone.trim(),
        headmaster: o.headmaster_name.trim(),
      },
      show_attendance: o.show_attendance,
      show_attributes: o.show_attributes,
    },
  };
}

function Toggle({ label, hint, checked, onChange, testId }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{label}</p>
        {hint && <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 ${
          checked ? "border-blue-600 bg-blue-600" : "border-gray-300 bg-gray-200 dark:border-white/15 dark:bg-white/10"
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">{hint}</span>}
    </label>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" data-testid="templates-skeleton">
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={CARD}>
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="mt-4 h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-4 h-9 w-36" />
          </div>
        ))}
      </div>
      <div className={CARD}>
        <Skeleton className="h-5 w-48" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReportCardTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [scheme, setScheme] = useState<ReportCardScheme | null>(null);
  const [builder, setBuilder] = useState<ReportCardBuilderKind>("normal");
  const [opts, setOpts] = useState<Opts>(DEFAULT_TVET_OPTIONS);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const saved = useRef("");
  const [savingOpts, setSavingOpts] = useState(false);
  const [switchTo, setSwitchTo] = useState<ReportCardBuilderKind | null>(null);
  const [switching, setSwitching] = useState(false);
  const [preview, setPreview] = useState<ReportCardBuilderKind | null>(null);

  const [modules, setModules] = useState<TemplateModule[] | null>(null);
  const [modulesState, setModulesState] = useState<"loading" | "ready" | "failed">("loading");
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const snapshot = (o: Opts, w: Record<string, string>) =>
    JSON.stringify({ ...o, module_weights: Object.fromEntries(Object.entries(w).filter(([, v]) => v.trim() !== "").sort()) });

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    ReportCardWorkflowApi.scheme()
      .then((res) => {
        if (!live) return;
        const s = res.data.scheme;
        const o = { ...DEFAULT_TVET_OPTIONS, ...(s.tvet ?? {}) };
        const w = Object.fromEntries(Object.entries(o.module_weights ?? {}).map(([k, v]) => [k, String(v)]));
        setScheme(s);
        setBuilder(s.builder === "tvet" ? "tvet" : "normal");
        setOpts(o);
        setWeights(w);
        saved.current = snapshot(o, w);
      })
      .catch((e) => {
        if (!live) return;
        const msg = apiMessage(e, "Couldn't load the report card templates.");
        setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [reload]);

  const loadModules = useCallback(() => {
    setModulesState("loading");
    ReportCardWorkflowApi.templateModules()
      .then((res) => {
        setModules(res.data.modules);
        setModulesState("ready");
      })
      .catch((e) => {
        setModulesState("failed");
        toast.error(apiMessage(e, "Couldn't load the modules from MIS."));
      });
  }, []);
  useEffect(() => loadModules(), [loadModules]);

  const errors = useMemo(() => validateTvetOptions(opts, weights), [opts, weights]);
  const dirty = snapshot(opts, weights) !== saved.current;
  const patch = (p: Partial<Opts>) => setOpts((o) => ({ ...o, ...p }));

  const samples = useMemo(
    () => ({
      normal: sampleNormalDocument(),
      tvet: decorateTvet(sampleTvetDocument(true), opts),
    }),
    [opts],
  );
  const decorate = useCallback((d: ReportCardDocument) => decorateTvet(d, opts), [opts]);

  const confirmSwitch = async () => {
    const to = switchTo;
    setSwitchTo(null);
    if (!to) return;
    setSwitching(true);
    try {
      const res = await ReportCardWorkflowApi.saveScheme({ builder: to });
      setBuilder(res.data.scheme.builder === "tvet" ? "tvet" : "normal");
      setScheme(res.data.scheme);
      await refreshReportCardStructure(to === "tvet" ? TVET_STRUCTURE : undefined);
      toast.success(`The school now uses the ${to === "tvet" ? "TVET" : "Normal"} builder. Teachers map marks into ${to === "tvet" ? "FA, CA and IA" : "CW, HW, MD and EOT"}.`);
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't switch the report card builder."));
    } finally {
      setSwitching(false);
    }
  };

  const saveOpts = async () => {
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSavingOpts(true);
    try {
      const module_weights = Object.fromEntries(Object.entries(weights).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)]));
      const res = await ReportCardWorkflowApi.saveScheme({ tvet: { ...opts, module_weights } });
      const o = { ...DEFAULT_TVET_OPTIONS, ...(res.data.scheme.tvet ?? {}) };
      const w = Object.fromEntries(Object.entries(o.module_weights ?? {}).map(([k, v]) => [k, String(v)]));
      setOpts(o);
      setWeights(w);
      saved.current = snapshot(o, w);
      toast.success("TVET template saved.");
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't save the TVET template."));
    } finally {
      setSavingOpts(false);
    }
  };

  const shownModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (modules ?? []).filter(
      (m) => (!q || m.name.toLowerCase().includes(q) || (m.code ?? "").toLowerCase().includes(q)) && (!onlyMissing || (m.learning_hours == null && !(weights[String(m.id)] ?? "").trim())),
    );
  }, [modules, query, onlyMissing, weights]);
  const missingHours = (modules ?? []).filter((m) => m.learning_hours == null && !(weights[String(m.id)] ?? "").trim()).length;
  const overrides = Object.values(weights).filter((v) => v.trim() !== "").length;

  const templates: Array<{ key: ReportCardBuilderKind; doc: ReportCardDocument; structure: typeof NORMAL_STRUCTURE; points: string[] }> = [
    {
      key: "normal",
      doc: samples.normal,
      structure: { ...NORMAL_STRUCTURE, categories: NORMAL_STRUCTURE.categories.map((c) => ({ ...c, weight: scheme?.category_weights?.[c.key as "CW"] ?? c.weight })) },
      points: ["Weighted categories out of 100", "Letter grades, class average, position", "Attendance, attributes, comments"],
    },
    {
      key: "tvet",
      doc: samples.tvet,
      structure: TVET_STRUCTURE,
      points: ["FA · CA · IA out of each module's weight", "Termly cards; Term 3 carries the year (AT, %, decision)", "Competent / NYC by RTB pass lines, conduct /40"],
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        breadcrumb={[{ label: "Report cards", to: "/report-cards" }, { label: "Builders and templates" }]}
        icon={<LayoutTemplate className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden />}
        title="Report card builders and templates"
        description="Choose how teachers map marks and how every card in the school looks. Cards already approved keep the format they were approved in."
        actions={
          <Link to="/report-cards/settings" className={GHOST}>
            <Settings2 className="h-4 w-4" aria-hidden /> Card settings
          </Link>
        }
      />

      {loading ? (
        <PageSkeleton />
      ) : loadError || !scheme ? (
        <div className={`${CARD} flex flex-col items-center gap-3 p-8 text-center`}>
          <AlertCircle className="h-8 w-8 text-blue-600" aria-hidden />
          <p className="text-sm text-text-primary-light dark:text-text-primary-dark">{loadError ?? "Couldn't load the templates."}</p>
          <button type="button" onClick={() => setReload((r) => r + 1)} className={GHOST}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      ) : (
        <>
          {/* 1. The builder: two templates side by side */}
          <section aria-labelledby="tpl-builders">
            <h2 id="tpl-builders" className="mb-3 text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
              Builder
            </h2>
            <div role="radiogroup" aria-label="Report card builder" className="grid gap-4 md:grid-cols-2">
              {templates.map((t) => {
                const active = builder === t.key;
                return (
                  <article
                    key={t.key}
                    role="radio"
                    aria-checked={active}
                    data-testid={`template-${t.key}`}
                    className={`flex flex-col rounded-3xl border bg-white p-3 transition-colors dark:bg-panel-dark ${
                      active ? "border-blue-600 ring-2 ring-blue-500/20 dark:border-blue-500" : "border-gray-200 hover:border-blue-300 dark:border-panel-line dark:hover:border-blue-500/40"
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setPreview(t.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setPreview(t.key);
                        }
                      }}
                      aria-label={`Preview the ${t.structure.label} template`}
                      className="group relative block h-64 cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-panel-line dark:bg-panel-raised"
                    >
                      <div className="px-3 pt-3">
                        <div className="overflow-hidden rounded-xl bg-white">
                          <TemplateCanvas doc={t.doc} />
                        </div>
                      </div>
                      <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-gray-50 to-transparent dark:from-panel-raised" aria-hidden="true" />
                      <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-panel-dark dark:text-blue-300">
                        <Eye className="h-3.5 w-3.5" aria-hidden /> Open preview
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{t.structure.label}</h3>
                        {active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white" data-testid={`in-use-${t.key}`}>
                            <Check className="h-3 w-3" aria-hidden /> In use
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">{t.structure.description}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Mapping categories">
                        {t.structure.categories.map((c) => (
                          <span
                            key={c.key}
                            title={c.hint}
                            className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                          >
                            {c.short} {t.key === "tvet" ? "/ weight" : `${c.weight}%`}
                          </span>
                        ))}
                      </div>
                      <ul className="mt-3 space-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        {t.points.map((p) => (
                          <li key={p} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" aria-hidden /> {p}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                        <button type="button" onClick={() => setPreview(t.key)} className={GHOST} data-testid={`preview-${t.key}`}>
                          <Eye className="h-4 w-4" aria-hidden /> Preview
                        </button>
                        {active ? (
                          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Teachers map marks into {t.structure.categories.map((c) => c.short).join(", ")}.</span>
                        ) : (
                          <button type="button" onClick={() => setSwitchTo(t.key)} disabled={switching} className={PRIMARY} data-testid={`use-${t.key}`}>
                            {switching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                            Use this builder
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* 2. TVET template options + live preview */}
          <section aria-labelledby="tpl-tvet" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 id="tpl-tvet" className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                    TVET template
                  </h2>
                  <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {builder === "tvet"
                      ? "What the CAMIS header and footer print, and each module's weight."
                      : "Kept ready for when the school switches to the TVET builder."}
                  </p>
                </div>
                {builder !== "tvet" && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-text-secondary-light dark:bg-white/10 dark:text-text-secondary-dark">Not in use</span>
                )}
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">School block</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="District">
                  <input className={INPUT} value={opts.district} onChange={(e) => patch({ district: e.target.value })} placeholder="e.g. Gasabo" aria-label="District" />
                </Field>
                <Field label="Headmaster's name" hint="Printed above the signature and stamp.">
                  <input className={INPUT} value={opts.headmaster_name} onChange={(e) => patch({ headmaster_name: e.target.value })} aria-label="Headmaster's name" />
                </Field>
                <Field label="School email">
                  <input className={INPUT} type="email" value={opts.school_email} onChange={(e) => patch({ school_email: e.target.value })} aria-label="School email" />
                </Field>
                <Field label="School phone">
                  <input className={INPUT} value={opts.school_phone} onChange={(e) => patch({ school_phone: e.target.value })} aria-label="School phone" />
                </Field>
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Qualification</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Qualification title" hint="Leave blank for “TVET Certificate <level> in <trade>” from MIS.">
                  <input className={INPUT} value={opts.qualification_title} onChange={(e) => patch({ qualification_title: e.target.value })} placeholder="Automatic" aria-label="Qualification title" />
                </Field>
                <Field label="Sector">
                  <input className={INPUT} value={opts.sector} onChange={(e) => patch({ sector: e.target.value })} placeholder="e.g. ICT and Multimedia" aria-label="Sector" />
                </Field>
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">School additions</h3>
              <div className="mt-1 divide-y divide-gray-100 dark:divide-panel-line">
                <Toggle label="Show attendance" hint="Not on the CAMIS card; a short line under the table." checked={opts.show_attendance} onChange={(v) => patch({ show_attendance: v })} testId="toggle-attendance" />
                <Toggle label="Show general attributes" hint="The class teacher's ratings, as one line." checked={opts.show_attributes} onChange={(v) => patch({ show_attributes: v })} testId="toggle-attributes" />
              </div>

              {/* Module weights */}
              <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Module weights</h3>
                  <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    FA, CA and IA are each out of the module weight (learning hours). MIS gives most; set the rest, or override one.
                  </p>
                </div>
                <div className="w-40">
                  <Field label="Default weight">
                    <input
                      className={INPUT}
                      type="number"
                      min={1}
                      max={1000}
                      value={Number.isFinite(opts.default_module_weight) ? opts.default_module_weight : ""}
                      onChange={(e) => patch({ default_module_weight: e.target.value === "" ? NaN : Number(e.target.value) })}
                      aria-label="Default module weight"
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[12rem] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                  <input className={`${INPUT} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search modules by name or code" aria-label="Search modules" />
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyMissing((v) => !v)}
                  aria-pressed={onlyMissing}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    onlyMissing ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-text-primary-light hover:border-blue-300 dark:border-panel-line dark:text-text-primary-dark"
                  }`}
                  data-testid="only-missing"
                >
                  No hours in MIS{modules ? ` (${missingHours})` : ""}
                </button>
                {overrides > 0 && <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{overrides} set by the school</span>}
              </div>
              <div className="mt-3 max-h-[26rem] overflow-y-auto rounded-2xl border border-gray-200 dark:border-panel-line">
                {modulesState === "loading" ? (
                  <div className="space-y-2 p-3" data-testid="modules-skeleton">
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : modulesState === "failed" ? (
                  <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Couldn't load the modules from MIS.
                    <button type="button" onClick={loadModules} className={GHOST}>
                      <RotateCcw className="h-4 w-4" aria-hidden /> Try again
                    </button>
                  </div>
                ) : shownModules.length === 0 ? (
                  <p className="p-6 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">{modules?.length ? "No module matches." : "MIS has no modules yet."}</p>
                ) : (
                  <table className="w-full text-sm" data-testid="module-weights">
                    <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase tracking-wide text-text-secondary-light dark:bg-panel-raised dark:text-text-secondary-dark">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Module</th>
                        <th className="hidden px-3 py-2 font-semibold sm:table-cell">Group</th>
                        <th className="px-3 py-2 text-right font-semibold">MIS hours</th>
                        <th className="px-3 py-2 text-right font-semibold">Weight on the card</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownModules.map((m) => {
                        const own = weights[String(m.id)] ?? "";
                        const effective = own.trim() ? Number(own) : (m.learning_hours ?? opts.default_module_weight);
                        return (
                          <tr key={m.id} className="border-t border-gray-100 dark:border-panel-line" data-testid={`module-${m.id}`}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-text-primary-light dark:text-text-primary-dark">{m.name}</div>
                              {m.code && <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">{m.code}</div>}
                            </td>
                            <td className="hidden px-3 py-2 text-xs text-text-secondary-light dark:text-text-secondary-dark sm:table-cell">{m.category ? CATEGORY_LABEL[m.category] : "–"}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-secondary-light dark:text-text-secondary-dark">{m.learning_hours ?? "–"}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={1000}
                                  value={own}
                                  placeholder={String(m.learning_hours ?? opts.default_module_weight)}
                                  onChange={(e) => setWeights((w) => ({ ...w, [String(m.id)]: e.target.value }))}
                                  aria-label={`${m.name} weight`}
                                  className={`${INPUT} w-24 text-right tabular-nums`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setWeights((w) => ({ ...w, [String(m.id)]: "" }))}
                                  disabled={!own.trim()}
                                  aria-label={`Use the MIS weight for ${m.name}`}
                                  title="Use MIS (or the default)"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary-light transition-colors hover:text-blue-700 disabled:opacity-30 dark:text-text-secondary-dark dark:hover:text-blue-300"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              </div>
                              {!own.trim() && m.learning_hours == null && (
                                <div className="mt-0.5 text-right text-[11px] text-blue-700 dark:text-blue-300">Default {Number.isFinite(effective) ? effective : "–"}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {errors.length > 0 && (
                <ul data-testid="tvet-errors" className="mt-4 space-y-1 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                  {errors.map((e) => (
                    <li key={e} className="flex items-start gap-1.5">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden /> {e}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-panel-line">
                {dirty ? (
                  <button
                    type="button"
                    className={GHOST}
                    onClick={() => {
                      const s = JSON.parse(saved.current) as Opts;
                      setOpts({ ...DEFAULT_TVET_OPTIONS, ...s });
                      setWeights(Object.fromEntries(Object.entries(s.module_weights ?? {}).map(([k, v]) => [k, String(v)])));
                    }}
                  >
                    Discard changes
                  </button>
                ) : (
                  !savingOpts && (
                    <span className="flex items-center gap-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" aria-hidden /> No unsaved changes
                    </span>
                  )
                )}
                <button type="button" onClick={() => void saveOpts()} disabled={savingOpts || !dirty || errors.length > 0} className={PRIMARY} data-testid="save-tvet">
                  {savingOpts ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                  {savingOpts ? "Saving…" : "Save TVET template"}
                </button>
              </div>
            </div>

            {/* Live preview of the options being edited */}
            <aside className="lg:sticky lg:top-4 lg:self-start">
              <div className={CARD}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Live preview</p>
                  <button type="button" onClick={() => setPreview("tvet")} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                    Full size
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">Sample learner, your settings{dirty ? " (unsaved)" : ""}.</p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-panel-line" data-testid="live-preview">
                  <TemplateCanvas doc={samples.tvet} />
                </div>
              </div>
            </aside>
          </section>

          {/* 3. Normal template options live on the settings page */}
          <section className={CARD} aria-labelledby="tpl-normal">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="tpl-normal" className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Normal template
                </h2>
                <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  Weights CW {scheme.category_weights.CW} · HW {scheme.category_weights.HW} · MD {scheme.category_weights.MD} · EOT {scheme.category_weights.EOT}, pass mark {scheme.pass_mark}%, position{" "}
                  {scheme.show_position ? "shown" : "hidden"}, class average {scheme.show_class_average ? "shown" : "hidden"}.
                </p>
              </div>
              <Link to="/report-cards/settings" className={GHOST}>
                <Settings2 className="h-4 w-4" aria-hidden /> Edit in settings
              </Link>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={switchTo != null}
        title={`Use the ${switchTo === "tvet" ? "TVET" : "Normal"} builder?`}
        description={
          switchTo === "tvet"
            ? "Teachers will map marks into FA, CA and IA, each out of the module weight, and draft cards will use the TVET (CAMIS) template. Existing CW/HW/MD mappings count as FA and EOT as CA, nothing is deleted. Approved and published cards keep the format they were approved in."
            : "Teachers will map marks into CW, HW, MD and EOT with the school's weights, and draft cards will use the Normal template. Existing FA mappings count as MD and CA as EOT; IA mappings won't count. Approved and published cards keep the format they were approved in."
        }
        confirmLabel="Switch builder"
        onConfirm={() => void confirmSwitch()}
        onCancel={() => setSwitchTo(null)}
      />
      {preview && <TemplatePreviewModal builder={preview} open onClose={() => setPreview(null)} decorate={preview === "tvet" ? decorate : undefined} />}
    </div>
  );
}
