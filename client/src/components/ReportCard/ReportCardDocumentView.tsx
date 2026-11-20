import { NormalTemplate } from "./templates/NormalTemplate";
import { TvetTemplate } from "./templates/TvetTemplate";
import type { TemplateProps } from "./templates/types";

/**
 * The report card as issued, in the template of the builder it was made with
 * (the document records it, so a frozen card keeps its format if the school
 * later switches): TVET (RTB / CAMIS) or Normal. A snapshot from before
 * builders existed has no builder and is Normal.
 */
export function ReportCardDocumentView(props: TemplateProps) {
  if (props.doc.builder === "tvet" && props.doc.tvet) return <TvetTemplate {...props} />;
  return <NormalTemplate {...props} />;
}

export default ReportCardDocumentView;
