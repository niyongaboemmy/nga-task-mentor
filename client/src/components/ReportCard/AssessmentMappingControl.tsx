import { Loader2, Puzzle } from "lucide-react";
import Tooltip from "../ui/Tooltip";
import type { AssessmentCategory } from "../../services/reportCardApi";
import { CATEGORIES, CATEGORY_ORDER } from "./categoryMeta";
import Select from "../ui/Select";

// ─── Reusable "map this assessment to a report-card category" control ────────
// A single assessment can be mapped into one of CW/HW/MD/EOT (or left
// unmapped). This is deliberately a plain <Select> rather than a floating
// popover/menu: it renders correctly inside scrolling containers (a table
// body with overflow-x-auto, a list, a card) with no clipping or z-index
// work, and the browser's native dropdown needs no extra a11y wiring.
// Used on the Grades page (quick-map without opening the Report Card
// Builder) — reusable anywhere else an assessment's mapping needs a
// lightweight, inline editor.

export interface AssessmentMappingControlProps {
  /** Current category this assessment is mapped to, or null if unmapped. */
  category: AssessmentCategory | null;
  onChange: (category: AssessmentCategory | null) => void;
  disabled?: boolean;
  /** Shows a spinner and disables interaction while a save is in flight. */
  saving?: boolean;
  className?: string;
  /**
   * Set when the assessment can't go on a report card (an assignment whose
   * marks are part of another assessment): shows why instead of the picker.
   */
  lockedReason?: string | null;
}

export default function AssessmentMappingControl({
  category,
  onChange,
  disabled = false,
  saving = false,
  className = "",
  lockedReason = null,
}: AssessmentMappingControlProps) {
  const meta = category ? CATEGORIES[category] : null;

  if (lockedReason) {
    return (
      <Tooltip label={lockedReason}>
        <span
          className={`inline-flex h-7 cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-border-light px-2.5 text-[11px] font-semibold text-text-secondary-light dark:border-border-dark/50 dark:text-text-secondary-dark ${className}`}
          aria-label={`Can't be mapped: ${lockedReason}`}
          data-testid="mapping-locked"
          tabIndex={0}
        >
          <Puzzle className="h-3.5 w-3.5" aria-hidden="true" />
          Part of another
        </span>
      </Tooltip>
    );
  }

  return (
    <div className={`group relative inline-flex items-center ${className}`}>
      <Select size="sm" variant="bare"
        value={category ?? ""}
        disabled={disabled || saving}
        onChange={(e) => onChange((e.target.value || null) as AssessmentCategory | null)}
        aria-label="Report card category"
        triggerClassName={`!h-7 rounded-full text-[11px] font-semibold ${
          meta
            ? `${meta.badge} border-transparent`
            : "bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark/70 border-border-light dark:border-border-dark/40"
        }`}
      >
        <option value="">
          Unmapped
        </option>
        {CATEGORY_ORDER.map((cat) => (
          <option key={cat} value={cat}>
            {CATEGORIES[cat].label} ({CATEGORIES[cat].weight}%)
          </option>
        ))}
      </Select>
      {saving && (
        <span className="absolute -right-1 -top-1 rounded-full bg-white dark:bg-gray-900 p-0.5 shadow">
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
        </span>
      )}
    </div>
  );
}
