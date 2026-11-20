import { useLayoutEffect, useRef, useState } from "react";
import { ReportCardDocumentView } from "../ReportCardDocumentView";
import type { ReportCardDocument } from "../../../services/reportCardApi";

/** A report card template scaled to the space it has (thumbnails, previews); `scale` fixes the zoom instead. */
export default function TemplateCanvas({ doc, scale, interactive = false, className = "" }: { doc: ReportCardDocument; scale?: number; interactive?: boolean; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(scale ?? 0.4);
  const [height, setHeight] = useState(1123);

  useLayoutEffect(() => {
    const measure = () => {
      const w = outer.current?.clientWidth ?? 0;
      if (!scale && w > 0) setFit(Math.min(1.25, w / 794));
      if (inner.current) setHeight(inner.current.scrollHeight);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && outer.current) ro.observe(outer.current);
    if (ro && inner.current) ro.observe(inner.current);
    return () => ro?.disconnect();
  }, [scale, doc]);

  const s = scale ?? fit;
  return (
    <div ref={outer} className={`relative overflow-hidden ${interactive ? "" : "rc-static"} ${className}`} style={{ height: height * s }}>
      {/* A thumbnail shows the card as printed: no screen-only controls. */}
      {!interactive && <style>{`.rc-static .rc-no-print { display: none !important; }`}</style>}
      <div
        ref={inner}
        aria-hidden={!interactive}
        style={{ width: 794, transform: `scale(${s})`, transformOrigin: "top left", pointerEvents: interactive ? "auto" : "none" }}
      >
        <ReportCardDocumentView doc={doc} />
      </div>
    </div>
  );
}
