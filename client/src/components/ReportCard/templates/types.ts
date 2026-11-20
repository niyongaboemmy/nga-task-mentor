import type { ReportCardDocument, UnmappedMark } from "../../../services/reportCardApi";

/** What every report card template (screen) takes. */
export interface TemplateProps {
  doc: ReportCardDocument;
  verificationUrl?: string | null;
  /** Staff guidance on a draft (per subject id); undefined for students and frozen cards. */
  unmapped?: Record<number, UnmappedMark[]>;
  /** In-app navigation for the guidance links (falls back to plain links). */
  onOpen?: (url: string) => void;
}
