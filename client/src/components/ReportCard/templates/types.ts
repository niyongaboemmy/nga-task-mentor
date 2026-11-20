import type { ReactNode } from "react";
import type { ReportCardDocument, UnmappedMark } from "../../../services/reportCardApi";
import type { SchoolProfileField } from "../../../services/reportCardWorkflowApi";

/** The visual editor: renders a school field as an inline-editable value. */
export interface TemplateEditor {
  field: (key: SchoolProfileField, value: string, opts?: { placeholder?: string; upper?: boolean }) => ReactNode;
}

/** What every report card template (screen) takes. */
export interface TemplateProps {
  doc: ReportCardDocument;
  verificationUrl?: string | null;
  /** Staff guidance on a draft (per subject id); undefined for students and frozen cards. */
  unmapped?: Record<number, UnmappedMark[]>;
  /** In-app navigation for the guidance links (falls back to plain links). */
  onOpen?: (url: string) => void;
  /** Visual editing of the school's details (template preview); absent = the printed card. */
  editor?: TemplateEditor;
}
