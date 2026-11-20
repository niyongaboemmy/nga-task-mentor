import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import type { AssessmentCategory, BuilderStructure } from "../../services/reportCardApi";

export interface SuggestionRow {
  key: string;
  title: string;
  kindLabel: string;
  suggested: AssessmentCategory | null;
}

/**
 * Map a subject's unmapped work in one go: each assessment with the category
 * it most likely belongs in (from its type), changeable or skippable, then
 * one save. The caller offers Undo afterwards.
 */
export default function SuggestMappingDialog({
  open,
  subjectName,
  rows,
  structure,
  onApply,
  onClose,
}: {
  open: boolean;
  subjectName: string;
  rows: SuggestionRow[];
  structure: BuilderStructure;
  onApply: (choices: Array<{ key: string; category: AssessmentCategory }>) => Promise<boolean>;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<Record<string, AssessmentCategory | "">>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setChoice(Object.fromEntries(rows.map((r) => [r.key, r.suggested ?? ""])));
  }, [open, rows]);

  const chosen = rows.filter((r) => choice[r.key]);
  const apply = async () => {
    setSaving(true);
    const ok = await onApply(chosen.map((r) => ({ key: r.key, category: choice[r.key] as AssessmentCategory })));
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" aria-hidden /> Map {subjectName}'s work
        </span>
      }
      subtitle={`Suggested from each assessment's type, in the ${structure.label} builder. Change any, or skip it.`}
      footer={
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark" aria-live="polite">
            {chosen.length} of {rows.length} will be mapped
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-text-primary-light hover:bg-gray-50 dark:border-panel-line dark:text-text-primary-dark dark:hover:bg-panel-raised">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={saving || chosen.length === 0}
              data-testid="apply-suggestions"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Map {chosen.length}
            </button>
          </div>
        </div>
      }
    >
      <ul className="divide-y divide-gray-100 dark:divide-panel-line" data-testid="suggestion-list">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary-light dark:text-text-primary-dark" title={r.title}>
                {r.title}
              </p>
              <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                {r.kindLabel}
                {r.suggested ? "" : " · no suggestion: pick one or skip"}
              </p>
            </div>
            <Select
              size="sm"
              value={choice[r.key] ?? ""}
              onChange={(e) => setChoice((c) => ({ ...c, [r.key]: e.target.value as AssessmentCategory | "" }))}
              aria-label={`Category for ${r.title}`}
              triggerClassName="!h-8 min-w-[12rem] rounded-xl text-xs"
            >
              <option value="">Skip</option>
              {structure.categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({structure.key === "tvet" ? "/ weight" : `${c.weight}%`})
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
