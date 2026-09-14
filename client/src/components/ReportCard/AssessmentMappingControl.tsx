import { Loader2 } from "lucide-react";
import type { AssessmentCategory } from "../../services/reportCardApi";
import { CATEGORIES, CATEGORY_ORDER } from "./categoryMeta";

// ─── Reusable "map this assessment to a report-card category" control ────────
// A single assessment can be mapped into one of CW/HW/MD/EOT (or left
// unmapped). This is deliberately a plain <select> rather than a floating
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
}

export default function AssessmentMappingControl({
  category,
  onChange,
  disabled = false,
  saving = false,
  className = "",
}: AssessmentMappingControlProps) {
  const meta = category ? CATEGORIES[category] : null;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={category ?? ""}
        disabled={disabled || saving}
        onChange={(e) => onChange((e.target.value || null) as AssessmentCategory | null)}
        aria-label="Report card category"
        className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-[11px] font-semibold border cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors ${
          meta
            ? `${meta.badge} border-transparent`
            : "bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark/70 border-border-light dark:border-border-dark/40"
        }`}
      >
        <option value="" className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
          Unmapped
        </option>
        {CATEGORY_ORDER.map((cat) => (
          <option key={cat} value={cat} className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
            {CATEGORIES[cat].label} ({CATEGORIES[cat].weight}%)
          </option>
        ))}
      </select>
      {saving && (
        <Loader2 className="w-3 h-3 animate-spin absolute right-1.5 pointer-events-none text-current opacity-80" />
      )}
    </div>
  );
}
