import { useMemo, useState } from "react";
import { Minus, Plus, Scan } from "lucide-react";
import Modal from "../../ui/Modal";
import TemplateCanvas from "./TemplateCanvas";
import { sampleNormalDocument, sampleTvetDocument } from "./sampleDocuments";
import type { ReportCardBuilderKind, ReportCardDocument } from "../../../services/reportCardApi";

/**
 * A template at full size with sample data: the TVET one as a termly card or
 * the Term 3 card with the year, with zoom. Read-only (teachers see the
 * school's template from the builder; admins from the template gallery).
 */
export default function TemplatePreviewModal({
  builder,
  open,
  onClose,
  decorate,
}: {
  builder: ReportCardBuilderKind;
  open: boolean;
  onClose: () => void;
  /** Applies unsaved template options to the sample (templates page). */
  decorate?: (doc: ReportCardDocument) => ReportCardDocument;
}) {
  const [variant, setVariant] = useState<"termly" | "final">("final");
  const [zoom, setZoom] = useState<number | null>(null);
  const doc = useMemo(() => {
    const d = builder === "tvet" ? sampleTvetDocument(variant === "final") : sampleNormalDocument();
    return decorate ? decorate(d) : d;
  }, [builder, variant, decorate]);
  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-semibold text-text-primary-light transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-panel-line dark:bg-panel-raised dark:text-text-primary-dark dark:hover:text-blue-300";
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="xxl"
      title={builder === "tvet" ? "TVET report card template" : "Normal report card template"}
      subtitle="Sample learner and marks. Your school's name, modules and marks replace them on real cards."
      bodyClassName="overflow-y-auto p-0"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-panel-line dark:bg-panel-dark/95">
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
      <div className="overflow-x-auto bg-gray-100 p-4 dark:bg-panel-dark">
        <div className="mx-auto rounded-xl bg-white" style={{ maxWidth: zoom ? undefined : 900, width: zoom ? 794 * zoom : undefined }}>
          <TemplateCanvas doc={doc} scale={zoom ?? undefined} interactive />
        </div>
      </div>
    </Modal>
  );
}

const r1 = (n: number) => Math.round(n * 10) / 10;
