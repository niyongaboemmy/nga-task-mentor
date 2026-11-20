import { useState } from "react";
import { Eye } from "lucide-react";
import TemplatePreviewModal from "./TemplatePreviewModal";
import type { ReportCardBuilderKind } from "../../../services/reportCardApi";

/** "View template": the school's report card template with sample data (read-only). */
export default function TemplatePreviewButton({ builder, label = "View template" }: { builder: ReportCardBuilderKind; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="view-template"
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-500/10"
      >
        <Eye className="h-3.5 w-3.5" /> {label}
      </button>
      {open && <TemplatePreviewModal builder={builder} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
