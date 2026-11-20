import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Lock, Minus, PenLine, Plus, RotateCcw, Save, Scan } from "lucide-react";
import { toast } from "react-toastify";
import Modal from "../../ui/Modal";
import ConfirmDialog from "../../ui/ConfirmDialog";
import TemplateCanvas from "./TemplateCanvas";
import InlineField from "./InlineField";
import { sampleNormalDocument, sampleTvetDocument } from "./sampleDocuments";
import type { TemplateEditor } from "./types";
import type { ReportCardBuilderKind, ReportCardDocument } from "../../../services/reportCardApi";
import { ReportCardWorkflowApi, apiMessage, type SchoolProfile, type SchoolProfileField } from "../../../services/reportCardWorkflowApi";

/**
 * A template at full size with sample data: the TVET one as a termly card or
 * the Term 3 card with the year, with zoom.
 *
 * With `editable` (the Templates page), the TVET card is also its own
 * editor: Edit outlines every school detail on the card (name, district,
 * email, phone, qualification, trade, sector, head of school); click one,
 * type, Enter. Changes stay a draft (counted, underlined) until Save, which
 * writes them to MIS for this school; "Show on the card" toggles save the
 * template's display options. Teachers get the read-only preview.
 */

const FIELD_LABEL: Record<SchoolProfileField, string> = {
  name: "school name",
  district: "district",
  contact_email: "school email",
  contact_phone: "school phone",
  sector: "sector",
  trade: "trade",
  qualification_title: "qualification title",
  head_teacher_name: "head of school",
  address: "address",
};
const MAX: Partial<Record<SchoolProfileField, number>> = { name: 150, district: 100, contact_email: 150, contact_phone: 50, sector: 100, trade: 150, qualification_title: 255, head_teacher_name: 150 };

type Values = Partial<Record<SchoolProfileField, string>>;
const fromProfile = (p: SchoolProfile | null): Values =>
  Object.fromEntries((Object.keys(FIELD_LABEL) as SchoolProfileField[]).map((k) => [k, (p?.[k] as string | null) ?? ""]));

/** The sample card dressed with the school's details as they'd print. */
function withSchool(doc: ReportCardDocument, v: Values, show?: { attendance: boolean; attributes: boolean }): ReportCardDocument {
  if (!doc.tvet) return doc;
  const t = (k: SchoolProfileField) => (v[k] ?? "").trim();
  return {
    ...doc,
    school: { ...doc.school, name: t("name") || doc.school.name },
    qualification: {
      ...(doc.qualification ?? { rqf_level: null, trade: null, title: null, sector: null }),
      title: t("qualification_title") || null,
      trade: t("trade") || null,
      sector: t("sector") || null,
    },
    tvet: {
      ...doc.tvet,
      school: { district: t("district"), email: t("contact_email"), phone: t("contact_phone"), headmaster: t("head_teacher_name") },
      ...(show ? { show_attendance: show.attendance, show_attributes: show.attributes } : {}),
    },
  };
}

export default function TemplatePreviewModal({
  builder,
  open,
  onClose,
  decorate,
  editable = false,
  startEditing = false,
  display,
  onSaved,
}: {
  builder: ReportCardBuilderKind;
  open: boolean;
  onClose: () => void;
  /** Applies unsaved template options to the sample (templates page). */
  decorate?: (doc: ReportCardDocument) => ReportCardDocument;
  /** Offer visual editing (school details in MIS, display options). */
  editable?: boolean;
  /** Open straight in edit mode. */
  startEditing?: boolean;
  /** The template's saved display options (editable mode). */
  display?: { attendance: boolean; attributes: boolean };
  /** After a save: what was saved, so the page can refresh. */
  onSaved?: (what: { school: boolean; display: boolean }) => void;
}) {
  const [variant, setVariant] = useState<"termly" | "final">("final");
  const [zoom, setZoom] = useState<number | null>(null);
  const canVisual = editable && builder === "tvet";

  // ── Visual editing state ──
  const [editing, setEditing] = useState(false);
  const [loadingSchool, setLoadingSchool] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [saved, setSaved] = useState<Values>({});
  const [draft, setDraft] = useState<Values>({});
  const [savedShow, setSavedShow] = useState(display ?? { attendance: false, attributes: false });
  const [show, setShow] = useState(display ?? { attendance: false, attributes: false });
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!open || !canVisual) return;
    let live = true;
    setLoadingSchool(true);
    ReportCardWorkflowApi.templateSchool()
      .then((r) => {
        if (!live) return;
        const v = fromProfile(r.data.profile);
        setSaved(v);
        setDraft(v);
        setCanEdit(r.data.can_edit);
        if (startEditing) setEditing(true);
      })
      .catch((e) => live && toast.error(apiMessage(e, "Couldn't load the school's details from MIS.")))
      .finally(() => live && setLoadingSchool(false));
    return () => {
      live = false;
    };
  }, [open, canVisual, startEditing]);
  useEffect(() => {
    if (display) {
      setSavedShow(display);
      setShow(display);
    }
  }, [display]);

  const changedFields = useMemo(
    () => (Object.keys(FIELD_LABEL) as SchoolProfileField[]).filter((k) => (draft[k] ?? "").trim() !== (saved[k] ?? "").trim()),
    [draft, saved],
  );
  const showChanged = show.attendance !== savedShow.attendance || show.attributes !== savedShow.attributes;
  const changes = changedFields.length + (show.attendance !== savedShow.attendance ? 1 : 0) + (show.attributes !== savedShow.attributes ? 1 : 0);

  const errors = useMemo(() => {
    const out: string[] = [];
    if (!(draft.name ?? "").trim() && changedFields.includes("name")) out.push("The school needs a name.");
    const em = (draft.contact_email ?? "").trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) out.push("The school email doesn't look right.");
    return out;
  }, [draft, changedFields]);

  const save = useCallback(async () => {
    if (!changes || saving) return;
    if (errors.length) return toast.error(errors[0]);
    setSaving(true);
    try {
      if (changedFields.length) {
        const r = await ReportCardWorkflowApi.saveTemplateSchool(Object.fromEntries(changedFields.map((k) => [k, (draft[k] ?? "").trim() || null])));
        const v = fromProfile(r.data.profile);
        setSaved(v);
        setDraft(v);
      }
      if (showChanged) {
        await ReportCardWorkflowApi.saveScheme({ tvet: { show_attendance: show.attendance, show_attributes: show.attributes } as never });
        setSavedShow(show);
      }
      toast.success(`Saved ${changes} change${changes === 1 ? "" : "s"}${changedFields.length ? " to MIS" : ""}. Report cards use ${changes === 1 ? "it" : "them"} from now on.`);
      onSaved?.({ school: changedFields.length > 0, display: showChanged });
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't save the template."));
    } finally {
      setSaving(false);
    }
  }, [changes, saving, errors, changedFields, draft, showChanged, show, onSaved]);

  // Ctrl/Cmd+S saves while editing.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, save]);

  const discard = () => {
    setDraft(saved);
    setShow(savedShow);
    toast.info("Changes discarded.");
  };
  const requestClose = () => (changes ? setConfirmClose(true) : onClose());

  const editor: TemplateEditor | undefined =
    editing && canVisual
      ? {
          field: (key, _value, opts) => (
            <InlineField
              value={draft[key] ?? ""}
              label={FIELD_LABEL[key]}
              placeholder={opts?.placeholder ?? `Add ${FIELD_LABEL[key]}`}
              upper={opts?.upper}
              maxLength={MAX[key]}
              disabled={!canEdit}
              changed={changedFields.includes(key)}
              onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
            />
          ),
        }
      : undefined;

  const doc = useMemo(() => {
    let d = builder === "tvet" ? sampleTvetDocument(variant === "final") : sampleNormalDocument();
    if (decorate) d = decorate(d);
    if (canVisual && (editing || Object.keys(saved).length)) d = withSchool(d, editing ? draft : saved, editing ? show : undefined);
    return d;
  }, [builder, variant, decorate, canVisual, editing, draft, saved, show]);

  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-semibold text-text-primary-light transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-panel-line dark:bg-panel-raised dark:text-text-primary-dark dark:hover:text-blue-300";
  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      on ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-text-primary-light hover:border-blue-300 dark:border-panel-line dark:text-text-primary-dark"
    }`;

  return (
    <Modal
      isOpen={open}
      onClose={requestClose}
      size="xxl"
      title={builder === "tvet" ? "TVET report card template" : "Normal report card template"}
      subtitle={
        editing
          ? "Click any outlined value on the card to change it. Save writes the school's details to MIS for this school."
          : "Sample learner and marks. Your school's name, modules and marks replace them on real cards."
      }
      bodyClassName="overflow-y-auto p-0"
    >
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-panel-line dark:bg-panel-dark/95">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          {builder === "tvet" && (
            <div role="tablist" aria-label="Card" className="inline-flex rounded-xl border border-gray-200 p-0.5 dark:border-panel-line">
              {(
                [
                  ["termly", "Termly card"],
                  ["final", "Term 3 (with the year)"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={variant === k}
                  onClick={() => setVariant(k)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    variant === k ? "bg-blue-600 text-white" : "text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-text-primary-dark"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          {canVisual && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              disabled={loadingSchool}
              aria-pressed={editing}
              data-testid="visual-edit-toggle"
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                editing ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
              }`}
            >
              {loadingSchool ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : editing ? <Check className="h-3.5 w-3.5" aria-hidden /> : <PenLine className="h-3.5 w-3.5" aria-hidden />}
              {editing ? "Editing" : "Edit"}
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.max(0.4, r1((z ?? 0.9) - 0.1)))} aria-label="Zoom out">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">{zoom ? `${Math.round(zoom * 100)}%` : "Fit"}</span>
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(1.6, r1((z ?? 0.9) + 0.1)))} aria-label="Zoom in">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button type="button" className={btn} onClick={() => setZoom(null)}>
              <Scan className="h-3.5 w-3.5" /> Fit
            </button>
          </div>
        </div>
        {editing && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2 dark:border-panel-line" data-testid="visual-edit-bar">
            {!canEdit ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark" data-testid="visual-edit-readonly">
                <Lock className="h-3.5 w-3.5" aria-hidden /> Only an MIS administrator (Manage schools) can change the school's details.
              </span>
            ) : (
              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">School details: click to edit.</span>
            )}
            <span className="mx-1 hidden h-4 w-px bg-gray-200 dark:bg-panel-line sm:block" aria-hidden />
            <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">Show on the card:</span>
            <button type="button" className={chip(show.attendance)} aria-pressed={show.attendance} onClick={() => setShow((s) => ({ ...s, attendance: !s.attendance }))} data-testid="visual-show-attendance">
              Attendance
            </button>
            <button type="button" className={chip(show.attributes)} aria-pressed={show.attributes} onClick={() => setShow((s) => ({ ...s, attributes: !s.attributes }))} data-testid="visual-show-attributes">
              General attributes
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-xs font-semibold ${changes ? "text-orange-600 dark:text-orange-300" : "text-text-secondary-light dark:text-text-secondary-dark"}`} aria-live="polite" data-testid="visual-edit-count">
                {changes ? `${changes} unsaved change${changes === 1 ? "" : "s"}` : "No changes"}
              </span>
              {changes > 0 && (
                <button type="button" onClick={discard} className={btn}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Discard
                </button>
              )}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!changes || saving}
                data-testid="visual-edit-save"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="overflow-x-auto bg-gray-100 p-4 dark:bg-panel-dark">
        <div className="mx-auto rounded-xl bg-white" style={{ maxWidth: zoom ? undefined : 900, width: zoom ? 794 * zoom : undefined }}>
          <TemplateCanvas doc={doc} scale={zoom ?? undefined} interactive editor={editor} />
        </div>
      </div>
      <ConfirmDialog
        open={confirmClose}
        title="Close without saving?"
        description={`${changes} change${changes === 1 ? " isn't" : "s aren't"} saved and will be lost.`}
        confirmLabel="Close"
        onConfirm={() => {
          setConfirmClose(false);
          setDraft(saved);
          setShow(savedShow);
          onClose();
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </Modal>
  );
}

const r1 = (n: number) => Math.round(n * 10) / 10;
