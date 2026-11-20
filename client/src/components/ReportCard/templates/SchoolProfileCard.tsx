import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Lock, RotateCcw, Save } from "lucide-react";
import { toast } from "react-toastify";
import { Skeleton } from "../../ui/Skeleton";
import { ReportCardWorkflowApi, apiMessage, type SchoolProfile, type SchoolProfileField, type TvetTemplateOptions } from "../../../services/reportCardWorkflowApi";

/**
 * The school's identity block, kept in MIS for this tenant (its School):
 * what report cards print as SCHOOL NAME, DISTRICT, SCHOOL EMAIL, TEL,
 * SECTOR, TRADE, QUALIFICATION TITLE and the head of school. Edited here
 * and saved to MIS (needs MIS "Manage schools"); read-only otherwise.
 * A value the template held before MIS had it is offered to move into MIS.
 */

const FIELDS: Array<{ key: SchoolProfileField; label: string; placeholder?: string; max: number; wide?: boolean; type?: string }> = [
  { key: "name", label: "School name", max: 150, wide: true },
  { key: "district", label: "District", placeholder: "e.g. Gasabo", max: 100 },
  { key: "head_teacher_name", label: "Head of school's name", placeholder: "Printed above the signature", max: 150 },
  { key: "contact_email", label: "School email", max: 150, type: "email" },
  { key: "contact_phone", label: "School phone", max: 50 },
  { key: "sector", label: "Sector", placeholder: "e.g. ICT and Multimedia", max: 100 },
  { key: "trade", label: "Trade", placeholder: "Used when a class has no programme", max: 150 },
  { key: "qualification_title", label: "Qualification title", placeholder: "e.g. TVET Certificate III in …", max: 255, wide: true },
  { key: "address", label: "Address", max: 255, wide: true },
];

/** The template's own values (before MIS held them), by MIS field. */
const fallbackOf = (t: TvetTemplateOptions): Partial<Record<SchoolProfileField, string>> => ({
  district: t.district,
  head_teacher_name: t.headmaster_name,
  contact_email: t.school_email,
  contact_phone: t.school_phone,
  sector: t.sector,
  qualification_title: t.qualification_title,
});

type Form = Record<SchoolProfileField, string>;
const toForm = (p: SchoolProfile | null): Form => Object.fromEntries(FIELDS.map((f) => [f.key, (p?.[f.key] as string | null) ?? ""])) as Form;

const INPUT =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary-light placeholder-gray-400 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-text-secondary-light dark:border-panel-line dark:bg-panel-raised dark:text-text-primary-dark dark:placeholder-white/25 dark:disabled:bg-white/[0.03]";

export default function SchoolProfileCard({ template, onDraft }: { template: TvetTemplateOptions; onDraft?: (p: Partial<Record<SchoolProfileField, string>>) => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [source, setSource] = useState<"mis" | "last" | "none">("none");
  const [saved, setSaved] = useState<Form>(toForm(null));
  const [form, setForm] = useState<Form>(toForm(null));
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailed(false);
    ReportCardWorkflowApi.templateSchool(reload > 0)
      .then((res) => {
        if (!live) return;
        const base = toForm(res.data.profile);
        setSaved(base);
        // Offer the template's earlier values where MIS has none yet.
        const fb = fallbackOf(template);
        const next = { ...base };
        for (const [k, v] of Object.entries(fb)) if (!next[k as SchoolProfileField] && v?.trim()) next[k as SchoolProfileField] = v.trim();
        setForm(next);
        setCanEdit(res.data.can_edit);
        setSource(res.data.source);
      })
      .catch((e) => {
        if (!live) return;
        setFailed(true);
        toast.error(apiMessage(e, "Couldn't load the school's details from MIS."));
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // The template's fallbacks are read once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  useEffect(() => onDraft?.(form), [form, onDraft]);

  const changed = useMemo(() => FIELDS.filter((f) => form[f.key].trim() !== saved[f.key].trim()).map((f) => f.key), [form, saved]);
  const moved = changed.filter((k) => !saved[k] && form[k] === (fallbackOf(template)[k] ?? "").trim());
  const errors = FIELDS.filter((f) => form[f.key].trim().length > f.max).map((f) => `${f.label} is at most ${f.max} characters.`);
  if (!form.name.trim() && !loading) errors.push("The school needs a name.");
  if (form.contact_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) errors.push("The school email doesn't look right.");

  const save = async () => {
    if (errors.length) return toast.error(errors[0]);
    setSaving(true);
    try {
      const patch = Object.fromEntries(changed.map((k) => [k, form[k].trim() || null]));
      const res = await ReportCardWorkflowApi.saveTemplateSchool(patch);
      const next = toForm(res.data.profile);
      setSaved(next);
      setForm(next);
      setSource("mis");
      toast.success("School details saved in MIS. Report cards use them from now on.");
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't save the school's details in MIS."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-panel-line dark:bg-panel-dark md:p-5" aria-labelledby="tpl-school" data-testid="school-profile">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" aria-hidden>
            <Building2 className="h-4 w-4" />
          </span>
          <div>
            <h2 id="tpl-school" className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
              School details
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Kept in MIS for this school and printed on its report cards (name, district, contacts, sector, trade, qualification, head of school).
            </p>
          </div>
        </div>
        {!loading && !failed && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              canEdit ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "bg-gray-100 text-text-secondary-light dark:bg-white/10 dark:text-text-secondary-dark"
            }`}
            data-testid="school-profile-mode"
          >
            {canEdit ? "Saved to MIS" : (
              <>
                <Lock className="h-3 w-3" aria-hidden /> Read-only
              </>
            )}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="school-profile-skeleton">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : failed ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-gray-200 p-5 text-center text-sm text-text-secondary-light dark:border-panel-line dark:text-text-secondary-dark">
          MIS didn't answer, so the school's details can't be shown.
          <button type="button" onClick={() => setReload((r) => r + 1)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold dark:border-panel-line">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        </div>
      ) : (
        <>
          {source !== "mis" && (
            <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-text-secondary-light dark:bg-white/[0.04] dark:text-text-secondary-dark">
              {source === "last" ? "MIS didn't answer just now; these are the details last read from it." : "MIS has no school set up yet."}
            </p>
          )}
          {!canEdit && (
            <p className="mt-3 rounded-xl border border-gray-200 px-3 py-2 text-xs text-text-secondary-light dark:border-panel-line dark:text-text-secondary-dark" data-testid="school-profile-readonly">
              Only an MIS administrator with <strong>Manage schools</strong> can change these, in MIS → Schools.
            </p>
          )}
          {canEdit && moved.length > 0 && (
            <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200" data-testid="school-profile-moved">
              {moved.length} value{moved.length === 1 ? "" : "s"} from this template {moved.length === 1 ? "isn't" : "aren't"} in MIS yet. Save to keep {moved.length === 1 ? "it" : "them"} with the school.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className={`flex flex-col gap-1 ${f.wide ? "sm:col-span-2" : ""}`}>
                <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  {f.label}
                  {changed.includes(f.key) && <span className="ml-1.5 font-semibold text-orange-600 dark:text-orange-300">· unsaved</span>}
                </span>
                <input
                  className={INPUT}
                  type={f.type ?? "text"}
                  value={form[f.key]}
                  maxLength={f.max}
                  disabled={!canEdit}
                  placeholder={f.placeholder}
                  aria-label={f.label}
                  onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          {canEdit && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-panel-line">
              {changed.length > 0 && (
                <button type="button" onClick={() => setForm(saved)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-text-primary-light hover:bg-gray-50 dark:border-panel-line dark:text-text-primary-dark dark:hover:bg-panel-raised">
                  Discard changes
                </button>
              )}
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || changed.length === 0 || errors.length > 0}
                data-testid="save-school-profile"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                {saving ? "Saving…" : changed.length ? `Save ${changed.length} to MIS` : "Saved in MIS"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
