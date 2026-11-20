import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { DocumentSubject, ReportCardDocument, TvetTermCell, UnmappedMark } from "../../../services/reportCardApi";
import ngaLogo from "../../../assets/branding/nga-logo-horizontal.png";
import type { TemplateProps } from "./types";

/**
 * The TVET report card template (screen): the RTB / CAMIS learner's
 * assessment report TSS schools issue. Its PDF twin is
 * server/src/services/reportCardPdfTvet.ts; both follow the same layout:
 *
 *   school block · learner block, the title, qualification / trade / RQF
 *   level / sector, Behaviour /40 per term, modules grouped Complementary →
 *   Core (General, Specific) with code, title, weight and FA IA CA TO per
 *   term (Term 3 adds the year: AT, %, Re, De), TOTALS · PERCENTAGE ·
 *   POSITION · Conduct · trainer's comments, then deliberation conditions,
 *   decision, abbreviations and the headmaster's signature with the stamp.
 *
 * Components are out of the module weight (learning hours); TO is out of the
 * weight per component assessed. On screen a module opens to show how its
 * marks are worked out; staff reading a draft also see marks not mapped yet.
 */

const C = {
  ink: "#111827",
  text: "#1F2937",
  muted: "#6B7280",
  faint: "#9CA3AF",
  grid: "#4B5563",
  line: "#E5E7EB",
  band: "#F3F4F6",
  core: "#E5E7EB",
  navy: "#16324F",
  blue: "#2563EB",
  blueSoft: "#EFF6FF",
  red: "#B42318",
  redSoft: "#FDECEA",
  green: "#05603A",
  greenSoft: "#E7F6EE",
};
const LOGOS: Record<string, string> = { nga: ngaLogo };
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const KIND: Record<UnmappedMark["kind"], string> = { quiz: "Quiz", assignment: "Assignment", manual: "Assessment" };
const exact = (n: number | null | undefined) => (n == null ? "" : String(Number(n.toFixed(2))));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** CAMIS order: Complementary, then CORE (General, Specific); anything uncategorised last. */
const SECTIONS: Array<{ key: DocumentSubject["category"] | null; label: string; core?: boolean }> = [
  { key: "complementary", label: "COMPLEMENTARY MODULES" },
  { key: "general", label: "GENERAL MODULES", core: true },
  { key: "specific", label: "SPECIFIC MODULES", core: true },
  { key: null, label: "OTHER MODULES" },
];

const TVET_ABBREVIATIONS: Array<[string, string]> = [
  ["FA", "Formative Assessment"],
  ["IA", "Integrated Assessment"],
  ["CA", "Comprehensive Assessment"],
  ["TO", "Total Marks"],
  ["AT", "Annual Total"],
  ["Re", "Re-assessment (%)"],
  ["De", "Decision"],
  ["C", "Competent"],
  ["NYC", "Not Yet Competent"],
];
const ABBR = Object.fromEntries(TVET_ABBREVIATIONS);

const CELL: React.CSSProperties = {
  border: `1px solid ${C.grid}`,
  padding: "4px 3px",
  fontSize: 10,
  textAlign: "center",
  verticalAlign: "middle",
  color: C.ink,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const HEAD: React.CSSProperties = { ...CELL, fontWeight: 700, fontSize: 9.5 };

/** The layout's terms and sections, also used by the template gallery. */
function tvetSections(doc: ReportCardDocument) {
  const all = doc.groups.flatMap((g) => g.subjects);
  return SECTIONS.map((s) => ({
    label: s.label,
    core: !!s.core,
    subjects: all.filter((x) => (x.category ?? null) === s.key).sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name)),
  })).filter((s) => s.subjects.length > 0);
}

export function TvetTemplate({ doc, verificationUrl, unmapped, onOpen }: TemplateProps) {
  const tv = doc.tvet!;
  const final = tv.final;
  const issued = doc.card.status === "approved" || doc.card.status === "published";
  const school = doc.school;
  const logo = school.logo ? LOGOS[school.logo] : undefined;
  const q = doc.qualification;
  const max = doc.behaviour?.max ?? 40;
  const [open, setOpen] = useState<Set<number>>(new Set());
  const sections = useMemo(() => tvetSections(doc), [doc]);
  const all = useMemo(() => sections.flatMap((s) => s.subjects), [sections]);
  const nTerms = tv.terms.length;

  const guide = unmapped !== undefined && !issued;
  const itemsOf = (s: DocumentSubject) => (guide ? (unmapped?.[s.subject_id] ?? []) : []);
  const unassessed = guide ? all.filter((s) => s.total == null && s.mapped === false) : [];
  const withUnmapped = guide ? all.filter((s) => itemsOf(s).length > 0) : [];
  const unmappedCount = withUnmapped.reduce((n, s) => n + itemsOf(s).length, 0);
  const nyc = all.filter((s) => (final ? s.tvet?.annual?.competent : s.competent) === false);
  const defaults = all.filter((s) => s.tvet?.weight_source === "default");
  const allOpen = all.length > 0 && all.every((s) => open.has(s.subject_id));
  const toggle = (id: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const go = (url: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpen) {
      e.preventDefault();
      onOpen(url);
    }
  };

  // Columns (px). Final: code, title, weight, 4 x terms, AT % Re De. Termly: code, title, weight, FA IA CA TO, % Decision.
  const comp = final ? [29, 27, 31, 37] : [56, 50, 56, 62];
  const tail = final ? [40, 44, 20, 28] : [56, 82];
  const codeW = final ? 60 : 78;
  const wtW = final ? 36 : 50;
  const fs = final ? 9 : 10; // module and totals rows; three terms are tight
  const cols = 3 + nTerms * 4 + tail.length;
  const conduct = (v: number | null | undefined) => (v != null ? `${exact(v)}/${max}` : "–");
  const num = (v: number | null | undefined) => (v != null ? exact(v) : <span style={{ color: C.faint }}>–</span>);
  const na = (v: number | null | undefined) => (v != null ? exact(v) : <span style={{ color: C.faint }}>N/A</span>);
  const label = (t: string) => <span title={ABBR[t] ?? t}>{t}</span>;

  const unmappedPanel = (s: DocumentSubject) => {
    const items = itemsOf(s);
    const none = s.total == null && s.mapped === false;
    if (!items.length && !none) return null;
    const mapUrl = items[0]?.map_url ?? `/grades/subjects/${s.subject_id}`;
    return (
      <div data-testid={`unmapped-${s.subject_id}`} style={{ border: "1px solid #BFDBFE", background: "#F5F9FF", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{items.length ? `${plural(items.length, "assessment")} with marks not mapped` : "No assessments mapped for this module"}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              {items.length ? "These marks count nowhere until each is put in FA, CA or IA." : "Nothing on this card counts for it yet. Map its assessments for this term in Grades."}
            </div>
          </div>
          <a
            href={`${BASE}${mapUrl}`}
            onClick={go(mapUrl)}
            data-testid={`map-${s.subject_id}`}
            style={{ flexShrink: 0, background: C.blue, color: "#fff", borderRadius: 10, padding: "6px 12px", fontSize: 10.5, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Map in Grades →
          </a>
        </div>
        {items.length > 0 && (
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
            {items.map((it) => (
              <li
                key={`${it.kind}:${it.id}`}
                style={{ display: "grid", gridTemplateColumns: "74px 1fr auto auto", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "6px 10px", fontSize: 10.5 }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: C.blue, background: C.blueSoft, borderRadius: 999, padding: "2px 8px", textAlign: "center" }}>{KIND[it.kind]}</span>
                <a href={`${BASE}${it.url}`} onClick={go(it.url)} title={it.title} style={{ color: C.ink, fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.title}
                </a>
                <span style={{ color: C.muted, whiteSpace: "nowrap" }}>{plural(it.recorded, "learner")} marked</span>
                <span style={{ fontWeight: 700, color: it.student_mark ? C.ink : C.muted, whiteSpace: "nowrap", minWidth: 64, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {it.student_mark ? `${exact(it.student_mark.raw)} / ${exact(it.student_mark.max)}` : "no mark"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  /** The module opened: each term's components as % of the weight, the year against the pass line. */
  const detail = (s: DocumentSubject) => {
    const t = s.tvet;
    const result = final ? t?.annual : t?.terms[nTerms - 1];
    const pct = result?.pct ?? null;
    const competent = final ? t?.annual?.competent : s.competent;
    const source = t?.weight_source === "school" ? "set by the school" : t?.weight_source === "mis" ? "learning hours in MIS" : "the default weight (MIS has no learning hours)";
    return (
      <tr className="rc-no-print" data-testid={`tvet-detail-${s.subject_id}`}>
        <td colSpan={cols} style={{ padding: "10px 12px 12px", background: "#FBFCFE", border: `1px solid ${C.grid}` }}>
          {unmappedPanel(s)}
          {t && (
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.muted }}>How the marks are worked out</div>
                <div style={{ fontSize: 10.5, color: C.text, marginTop: 4 }}>
                  Weight <strong>{exact(t.weight)}</strong> ({source}). Each component is scored out of the weight; TO adds the components assessed.
                </div>
                <table style={{ borderCollapse: "collapse", marginTop: 6, fontSize: 10.5, width: "100%" }}>
                  <thead>
                    <tr style={{ color: C.muted }}>
                      <th style={{ textAlign: "left", fontWeight: 600, padding: "2px 4px" }}>Term</th>
                      {["FA", "IA", "CA", "TO"].map((k) => (
                        <th key={k} style={{ fontWeight: 600, padding: "2px 4px" }}>
                          {k}
                        </th>
                      ))}
                      <th style={{ fontWeight: 600, padding: "2px 4px" }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tv.terms.map((term, i) => {
                      const c: TvetTermCell | null = t.terms[i] ?? null;
                      return (
                        <tr key={term.term} style={{ borderTop: `1px solid ${C.line}` }}>
                          <td style={{ padding: "3px 4px", fontWeight: 600 }}>{term.term}</td>
                          {(["fa", "ia", "ca"] as const).map((k) => (
                            <td key={k} style={{ textAlign: "center", padding: "3px 4px", color: c?.[k] != null ? C.ink : C.faint }}>
                              {c?.[k] != null ? `${exact(c[k])}/${exact(t.weight)}` : k === "ia" ? "N/A" : "–"}
                            </td>
                          ))}
                          <td style={{ textAlign: "center", padding: "3px 4px", fontWeight: 700 }}>{c?.to != null ? `${exact(c.to)}/${exact(c.max)}` : "–"}</td>
                          <td style={{ textAlign: "center", padding: "3px 4px" }}>{c?.pct != null ? `${exact(c.pct)}%` : "–"}</td>
                        </tr>
                      );
                    })}
                    {final && t.annual && (
                      <tr style={{ borderTop: `1px solid ${C.grid}` }}>
                        <td style={{ padding: "3px 4px", fontWeight: 700 }}>Year</td>
                        <td colSpan={3} />
                        <td style={{ textAlign: "center", padding: "3px 4px", fontWeight: 700 }}>{t.annual.at != null ? `${exact(t.annual.at)}/${exact(t.annual.max)}` : "–"}</td>
                        <td style={{ textAlign: "center", padding: "3px 4px", fontWeight: 700 }}>{t.annual.pct != null ? `${exact(t.annual.pct)}%` : "–"}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.muted }}>{final ? "The year against the pass line" : "This term against the pass line"}</div>
                <div style={{ position: "relative", height: 26, marginTop: 10 }}>
                  <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 6, borderRadius: 999, background: "#E5EBF2" }} />
                  {pct != null && (
                    <div style={{ position: "absolute", top: 10, left: 0, width: `${Math.min(100, pct)}%`, height: 6, borderRadius: 999, background: competent === false ? C.red : C.navy }} />
                  )}
                  {s.threshold != null && <div title={`Competent from ${s.threshold}%`} style={{ position: "absolute", top: 4, left: `${s.threshold}%`, width: 2, height: 18, background: C.muted }} />}
                </div>
                <div style={{ fontSize: 10.5, color: C.text, marginTop: 4 }}>
                  {pct != null ? (
                    <>
                      <strong>{exact(pct)}%</strong> · pass line {s.threshold}% ·{" "}
                      <strong style={{ color: competent === false ? C.red : C.green }}>{competent === false ? "Not Yet Competent" : "Competent"}</strong>
                    </>
                  ) : (
                    "No marks yet."
                  )}
                </div>
                {s.teacher && <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>Trainer: {s.teacher}</div>}
              </div>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const cellBase: React.CSSProperties = { ...CELL, fontSize: fs };
  const head: React.CSSProperties = { ...HEAD, fontSize: final ? 9 : 9.5 };
  // Totals run to six digits (1033.3) in the narrow three-term columns: smaller, never cut.
  const tot: React.CSSProperties = { ...head, fontSize: final ? 7.6 : 9.5, padding: final ? "4px 0" : head.padding, letterSpacing: final ? -0.2 : 0, textOverflow: "clip" };
  const moduleRow = (s: DocumentSubject) => {
    const t = s.tvet;
    const items = itemsOf(s);
    const isOpen = open.has(s.subject_id);
    const faded = s.total == null && !t?.terms.some(Boolean);
    return (
      <React.Fragment key={s.subject_id}>
        <tr
          className="rc-row"
          data-testid={`tvet-row-${s.subject_id}`}
          onClick={() => toggle(s.subject_id)}
          aria-expanded={isOpen}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle(s.subject_id);
            }
          }}
          style={{ background: isOpen ? "#F1F5FB" : "#fff" }}
        >
          <td style={{ ...cellBase, textAlign: "left" }}>{s.code ?? ""}</td>
          <td style={{ ...cellBase, textAlign: "left", color: faded ? C.muted : C.ink }} title={s.name}>
            <span className="rc-no-print" aria-hidden="true" style={{ display: "inline-block", width: 10, color: C.faint, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }}>
              ›
            </span>
            {s.name}
            {items.length > 0 && (
              <span
                className="rc-no-print"
                data-testid={`unmapped-chip-${s.subject_id}`}
                style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 700, color: C.blue, background: C.blueSoft, borderRadius: 999, padding: "1px 6px" }}
              >
                {items.length} not mapped
              </span>
            )}
            {guide && !items.length && s.total == null && s.mapped === false && (
              <span className="rc-no-print" style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 600, color: C.muted, background: C.band, borderRadius: 999, padding: "1px 6px" }}>
                nothing mapped
              </span>
            )}
          </td>
          <td style={cellBase} title={t ? `Weight ${exact(t.weight)}: ${t.weight_source === "school" ? "set by the school" : t.weight_source === "mis" ? "MIS learning hours" : "default"}` : undefined}>
            {t ? exact(t.weight) : "–"}
            {t?.weight_source === "default" && guide && (
              <span className="rc-no-print" style={{ color: C.blue }}>
                *
              </span>
            )}
          </td>
          {tv.terms.map((term, i) => {
            const c = t?.terms[i] ?? null;
            return (
              <React.Fragment key={term.term}>
                <td style={cellBase}>{num(c?.fa)}</td>
                <td style={cellBase}>{na(c?.ia)}</td>
                <td style={cellBase}>{num(c?.ca)}</td>
                <td style={{ ...cellBase, fontWeight: c?.to != null ? 700 : 400 }}>{num(c?.to)}</td>
              </React.Fragment>
            );
          })}
          {final ? (
            <>
              <td style={{ ...cellBase, fontWeight: 700 }}>{num(t?.annual?.at)}</td>
              <td style={cellBase}>{t?.annual?.pct != null ? `${exact(t.annual.pct)}%` : num(null)}</td>
              <td style={cellBase} />
              <td style={{ ...cellBase, fontWeight: 700, color: t?.annual?.competent === false ? C.red : C.ink }}>
                {t?.annual?.competent == null ? num(null) : t.annual.competent ? "C" : "NYC"}
              </td>
            </>
          ) : (
            <>
              <td style={cellBase}>{t?.terms[0]?.pct != null ? `${exact(t.terms[0].pct)}%` : num(null)}</td>
              <td style={{ ...cellBase, fontWeight: s.competent === false ? 700 : 500, color: s.competent === false ? C.red : s.competent == null ? C.faint : C.ink }}>
                {s.competent == null ? "–" : s.competent ? "Competent" : "NYC"}
              </td>
            </>
          )}
        </tr>
        {isOpen && detail(s)}
      </React.Fragment>
    );
  };

  const band = (labelText: string, fill = "#fff") => (
    <tr key={labelText}>
      <td colSpan={cols} style={{ ...cellBase, textAlign: "left", fontWeight: 700, fontSize: 10, background: fill, padding: "5px 6px" }}>
        {labelText}
      </td>
    </tr>
  );
  let coreShown = false;
  const body: React.ReactNode[] = [];
  for (const sec of sections) {
    if (sec.core && !coreShown) {
      body.push(band("CORE MODULES", C.core));
      coreShown = true;
    }
    body.push(band(sec.label));
    sec.subjects.forEach((s) => body.push(moduleRow(s)));
  }

  const summaryRow = (name: string, termVal: (t: (typeof tv.terms)[number]) => React.ReactNode, yearVal: React.ReactNode, testId: string) => (
    <tr data-testid={testId}>
      <td colSpan={2} style={{ ...head, textAlign: "left", padding: "5px 6px" }}>
        {name}
      </td>
      <td style={cellBase} />
      {tv.terms.map((t) => (
        <td key={t.term} colSpan={4} style={{ ...head }}>
          {termVal(t)}
        </td>
      ))}
      <td colSpan={tail.length} style={{ ...head }}>
        {yearVal}
      </td>
    </tr>
  );

  return (
    <div
      id="report-card-document"
      data-testid="report-card-document"
      data-template="tvet"
      style={{ width: 794, minHeight: 1123, background: "#fff", color: C.text, fontFamily: "Arial,'Helvetica Neue',sans-serif", padding: "26px 28px", boxSizing: "border-box", position: "relative", overflow: "hidden" }}
    >
      <style>{`
        @media print { .rc-no-print { display: none !important; } }
        .rc-row { cursor: pointer; transition: background-color .12s ease; }
        .rc-row:hover { background: #F1F5FB !important; }
        .rc-row:focus-visible { outline: 2px solid ${C.blue}; outline-offset: -2px; }
      `}</style>
      {!issued && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", transform: "rotate(-35deg)", fontSize: 110, fontWeight: 800, color: "rgba(180,35,24,0.06)", letterSpacing: 10 }}
        >
          PROVISIONAL
        </div>
      )}

      {/* School block · learner block */}
      <header data-testid="tvet-header" style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 12, border: `1px solid ${C.grid}`, padding: "10px 12px", fontSize: 10.5, fontWeight: 700, lineHeight: 1.55, color: C.ink }}>
        <div style={{ minWidth: 0 }}>
          <div>REPUBLIC OF RWANDA</div>
          <div>MINISTRY OF EDUCATION</div>
          <div>DISTRICT: {tv.school.district || "–"}</div>
          <div>SCHOOL NAME: {school.name.toUpperCase()}</div>
          {tv.school.email && <div>SCHOOL EMAIL: {tv.school.email}</div>}
          {tv.school.phone && <div>TEL: {tv.school.phone}</div>}
          {!tv.school.email && !tv.school.phone && school.contact_line && <div style={{ fontWeight: 400 }}>{school.contact_line}</div>}
        </div>
        {logo && <img src={logo} alt="" style={{ alignSelf: "center", height: 44, width: "auto", opacity: 0.95 }} />}
        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div>ACADEMIC YEAR: {doc.card.academic_year}</div>
          {!final && <div>TERM: {doc.card.term}</div>}
          <div>CLASS: {doc.student.class_name ?? "–"}</div>
          <div>LEARNER&apos;S NAME: {doc.student.name.toUpperCase()}</div>
          <div>SDMS ID No: {doc.student.registration_number ?? "–"}</div>
        </div>
      </header>
      <div data-testid="report-title" style={{ border: `1px solid ${C.grid}`, borderTop: "none", textAlign: "center", fontSize: 17, fontWeight: 800, letterSpacing: 0.3, padding: "6px 0", color: C.ink }}>
        {final ? "LEARNER'S ASSESSMENT REPORT" : "LEARNER'S TERMLY ASSESSMENT REPORT"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", fontSize: 10.5, fontWeight: 700, color: C.ink }}>
        {(
          [
            ["QUALIFICATION TITLE", q?.title || "–"],
            ["TRADE", q?.trade || doc.student.program_name || "–"],
            ["RQF LEVEL", q?.rqf_level ? `Level ${q.rqf_level}` : "–"],
            ["SECTOR", q?.sector || "–"],
          ] as Array<[string, string]>
        ).map(([k, v], i) => (
          <div key={k} title={v} style={{ border: `1px solid ${C.grid}`, borderTop: "none", borderLeft: i % 2 ? "none" : `1px solid ${C.grid}`, padding: "5px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {k}: {v}
          </div>
        ))}
      </div>

      {/* Mapping guidance and quick actions (screen only) */}
      {(guide && (unmappedCount > 0 || unassessed.length > 0)) || all.length > 0 ? (
        <div className="rc-no-print" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
          {guide && (unmappedCount > 0 || unassessed.length > 0) && (
            <div data-testid="mapping-guide" style={{ flex: "1 1 360px", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, border: "1px solid #BFDBFE", background: "#F5F9FF" }}>
              <span aria-hidden="true" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, background: C.blue, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>
                !
              </span>
              <div style={{ minWidth: 0, flex: 1, fontSize: 11 }}>
                <strong style={{ color: C.ink }}>
                  {unmappedCount > 0
                    ? `${plural(unmappedCount, "assessment")} with marks ${unmappedCount === 1 ? "isn't" : "aren't"} mapped`
                    : `${plural(unassessed.length, "module")} ${unassessed.length === 1 ? "has" : "have"} nothing mapped`}
                </strong>
                <span style={{ color: C.muted }}> · open a module to map them in FA, CA or IA.</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(new Set([...withUnmapped, ...unassessed].map((s) => s.subject_id)))}
                style={{ flexShrink: 0, border: "1px solid #BFDBFE", background: "#fff", color: C.blue, borderRadius: 10, padding: "5px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}
              >
                Show modules
              </button>
            </div>
          )}
          {nyc.length > 0 && (
            <span data-testid="nyc-chip" style={{ padding: "4px 11px", borderRadius: 999, background: C.redSoft, color: C.red, fontWeight: 600, fontSize: 11 }}>
              Not yet competent: {nyc.map((x) => x.code ?? x.name).slice(0, 3).join(", ")}
              {nyc.length > 3 ? ` +${nyc.length - 3}` : ""}
            </span>
          )}
          {guide && defaults.length > 0 && (
            <span title="These modules have no learning hours in MIS; set their weight in Report cards → Templates." style={{ padding: "4px 11px", borderRadius: 999, background: C.blueSoft, color: C.blue, fontWeight: 600, fontSize: 11 }}>
              * {plural(defaults.length, "module")} on the default weight
            </span>
          )}
          {all.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(allOpen ? new Set() : new Set(all.map((s) => s.subject_id)))}
              style={{ marginLeft: "auto", border: `1px solid ${C.line}`, background: "#fff", color: C.text, borderRadius: 10, padding: "5px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
      ) : null}

      {/* Modules */}
      <table data-testid="tvet-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: 10 }}>
        <colgroup>
          <col style={{ width: codeW }} />
          <col />
          <col style={{ width: wtW }} />
          {tv.terms.flatMap((t) => comp.map((w, j) => <col key={`${t.term}-${j}`} style={{ width: w }} />))}
          {tail.map((w, j) => (
            <col key={`tail-${j}`} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} colSpan={2} style={head}>
              Behavior
            </th>
            <th style={head}>MAX</th>
            {tv.terms.map((t) => (
              <th key={t.term} colSpan={4} style={head}>
                {t.term.toUpperCase()}
              </th>
            ))}
            <th colSpan={tail.length} style={head}>
              {final ? "Annual" : "Term"}
            </th>
          </tr>
          <tr data-testid="behaviour-row">
            <th style={head}>{max}</th>
            {tv.terms.map((t) => (
              <th key={t.term} colSpan={4} style={head}>
                {conduct(t.conduct)}
              </th>
            ))}
            <th colSpan={tail.length} style={head}>
              {final ? conduct(tv.annual?.conduct) : tv.terms[0]?.totals.pct != null ? `${exact(tv.terms[0].totals.pct)}%` : "–"}
            </th>
          </tr>
          <tr>
            <th style={{ ...head, textAlign: "left" }}>Module</th>
            <th style={{ ...head, textAlign: "left" }}>Module Title</th>
            <th style={head} title="Weight: the module's learning hours">
              {final ? "Wt." : "Weight"}
            </th>
            {tv.terms.map((t) =>
              ["FA", "IA", "CA", "TO"].map((k) => (
                <th key={`${t.term}-${k}`} style={head}>
                  {label(k)}
                </th>
              )),
            )}
            {(final ? ["AT", "%", "Re", "De"] : ["%", "Decision"]).map((k) => (
              <th key={k} style={head}>
                {label(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.length ? (
            body
          ) : (
            <tr>
              <td colSpan={cols} style={{ ...cellBase, color: C.muted, fontStyle: "italic", padding: 10 }}>
                No modules recorded for this term.
              </td>
            </tr>
          )}
          <tr data-testid="summary-totals">
            <td colSpan={2} style={{ ...head, textAlign: "left", padding: "5px 6px" }}>
              TOTALS
            </td>
            <td style={tot} title={final ? "The year's maximum" : "This term's maximum"}>
              {num(final ? tv.annual?.max : tv.terms[0]?.totals.max)}
            </td>
            {tv.terms.map((t) => (
              <React.Fragment key={t.term}>
                <td style={tot}>{num(t.totals.fa)}</td>
                <td style={tot}>{na(t.totals.ia)}</td>
                <td style={tot}>{num(t.totals.ca)}</td>
                <td style={tot}>{num(t.totals.to)}</td>
              </React.Fragment>
            ))}
            {final ? (
              <>
                <td style={tot}>{num(tv.annual?.total)}</td>
                <td style={tot}>{tv.annual?.pct != null ? `${exact(tv.annual.pct)}%` : "–"}</td>
                <td colSpan={2} style={tot} />
              </>
            ) : (
              <td colSpan={tail.length} style={tot} />
            )}
          </tr>
          {summaryRow("PERCENTAGE", (t) => (t.totals.pct != null ? `${exact(t.totals.pct)}%` : "–"), final && tv.annual?.pct != null ? `${exact(tv.annual.pct)}%` : final ? "–" : "", "summary-percentage")}
          {doc.scheme.show_position &&
            summaryRow(
              "POSITION",
              (t) => (t.position != null ? `${t.position} out of ${t.position_of}` : "–"),
              final ? (tv.annual?.position != null ? `${tv.annual.position} out of ${tv.annual.position_of}` : "–") : "",
              "summary-position",
            )}
          {summaryRow("Conduct", (t) => conduct(t.conduct), final ? conduct(tv.annual?.conduct) : "", "summary-conduct")}
          <tr data-testid="trainer-comments">
            <td colSpan={3} style={{ ...head, textAlign: "left", verticalAlign: "top", whiteSpace: "normal", height: 56, padding: "6px" }}>
              Class Trainer&apos;s Comments &amp; signature:
            </td>
            {tv.terms.map((t) => (
              <td key={t.term} colSpan={4} style={{ ...cellBase, whiteSpace: "normal", verticalAlign: "top", textAlign: "left", fontSize: 9.5, color: C.text }}>
                {t.comment ?? ""}
              </td>
            ))}
            <td colSpan={tail.length} style={cellBase} />
          </tr>
        </tbody>
      </table>

      {/* Optional school additions */}
      {(tv.show_attendance || (tv.show_attributes && doc.attributes.length > 0)) && (
        <div style={{ border: `1px solid ${C.grid}`, borderTop: "none", padding: "6px 8px", fontSize: 10, color: C.text, lineHeight: 1.6 }}>
          {tv.show_attendance && (
            <div>
              <strong>Attendance:</strong> present {doc.attendance.present}, absent {doc.attendance.absent}, excused {doc.attendance.excused}, late {doc.attendance.late}, sick {doc.attendance.sick} (of {doc.attendance.total} days)
            </div>
          )}
          {tv.show_attributes && doc.attributes.length > 0 && (
            <div>
              <strong>General attributes:</strong> {doc.attributes.map((a) => `${a.attribute_name} – ${a.rating}`).join("; ")}
            </div>
          )}
        </div>
      )}

      {/* Deliberation · decision · abbreviations · headmaster */}
      <footer style={{ display: "grid", gridTemplateColumns: "1.15fr 0.55fr 1.45fr 1.2fr", border: `1px solid ${C.grid}`, marginTop: 10, fontSize: 10, color: C.text }}>
        <div style={{ padding: "8px 10px", borderRight: `1px solid ${C.grid}` }}>
          <div style={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}>Deliberation Conditions:</div>
          <ol style={{ margin: 0, paddingLeft: 16, lineHeight: 1.45, listStyle: "decimal" }}>
            {tv.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </div>
        <div data-testid="deliberation" style={{ padding: "8px 10px", borderRight: `1px solid ${C.grid}` }}>
          <div style={{ fontWeight: 700, color: C.ink, marginBottom: 6 }}>Decision:</div>
          <div style={{ fontWeight: 700, color: tv.decision && !["Promoted", "Graduated"].includes(tv.decision) ? C.red : C.ink }}>{final ? (tv.decision ?? "–") : "–"}</div>
        </div>
        <div data-testid="legend" style={{ padding: "8px 10px", borderRight: `1px solid ${C.grid}` }}>
          <div style={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}>Abbreviation</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1px 10px", lineHeight: 1.45 }}>
            {TVET_ABBREVIATIONS.filter(([k]) => final || !["AT", "Re"].includes(k)).map(([k, v]) => (
              <div key={k}>
                <strong style={{ color: C.ink }}>{k}:</strong> {v}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontWeight: 700, color: C.ink }}>Headmaster&apos;s Names and Signature:</div>
          <div style={{ color: C.ink }}>{tv.school.headmaster || " "}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch", flex: 1 }}>
            <div style={{ flex: 1, minHeight: 48, border: `1px dashed ${C.faint}`, borderRadius: 6, display: "grid", placeItems: "center", color: C.faint, fontSize: 9 }}>School stamp</div>
            {issued && verificationUrl && (
              <a href={verificationUrl} target="_blank" rel="noopener noreferrer" title="Verify this report" style={{ display: "block", lineHeight: 0 }}>
                <QRCodeSVG value={verificationUrl} size={52} fgColor={C.navy} />
              </a>
            )}
          </div>
        </div>
      </footer>
      <div style={{ marginTop: 6, fontSize: 9, color: issued ? C.muted : C.red }}>
        {doc.next_term_begins_on && (
          <>
            Next term begins on{" "}
            {new Date(`${doc.next_term_begins_on}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.{" "}
          </>
        )}
        {issued ? `Version ${doc.card.version}. Scan the code to verify this report.` : "Provisional: not yet approved, so this report can't be verified."}
      </div>
    </div>
  );
}

export default TvetTemplate;
