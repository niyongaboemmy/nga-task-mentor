import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { DocumentSubject, ReportCardDocument, UnmappedMark } from "../../services/reportCardApi";
import { statusMeta } from "../../services/reportCardApi";
import ngaLogo from "../../assets/branding/nga-logo-horizontal.png";

/**
 * The report card as issued: the server's ReportCardDocument (a frozen
 * snapshot once approved, a live render while a draft), in the school's
 * identity and the RTB competence-based format the PDF uses
 * (services/reportCardDocumentPdf.ts): modules by category (specific /
 * general / complementary) with code, CW/HW/MD/EOT, mark out of 100, grade,
 * position in class, class average and the Competent / NYC decision.
 *
 * On screen it is interactive: click a module for its breakdown (how the mark
 * is worked out, against the class), or expand them all. The controls are
 * left out of print. Drafts carry a PROVISIONAL watermark.
 *
 * Staff reading a draft also get `unmapped`: every subject the class takes is
 * listed (an unassessed one says so), and a subject whose marked assessments
 * aren't mapped says how many; opening it lists them with a way to map them.
 */

const C = {
  navy: "#16324F",
  navySoft: "#EAF0F7",
  ink: "#0F172A",
  text: "#1E293B",
  muted: "#64748B",
  line: "#E2E8F0",
  faint: "#CBD5E1",
  zebra: "#F8FAFC",
  red: "#B42318",
  redSoft: "#FDECEA",
  green: "#05603A",
  greenSoft: "#E7F6EE",
  accent: "#B03A2E",
  blue: "#2563EB",
};

const LOGOS: Record<string, string> = { nga: ngaLogo };
const CATS = ["CW", "HW", "MD", "EOT"] as const;
const CAT_NAME: Record<(typeof CATS)[number], string> = { CW: "Class work", HW: "Homework", MD: "Midterm", EOT: "End of term exam" };
const RATINGS = ["Excellent", "Very good", "Good"];
/** Exact marks, never rounded to whole numbers: up to 2 decimals (the precision marks are stored at), trailing zeros dropped. */
const exact = (n: number | null | undefined) => (n == null ? "" : String(Number(n.toFixed(2))));
const f1 = exact;
const dash = <span style={{ color: "#CBD5E1" }}>–</span>;
const KIND: Record<UnmappedMark["kind"], string> = { quiz: "Quiz", assignment: "Assignment", manual: "Assessment" };
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

const cap: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.muted };
const th: React.CSSProperties = {
  background: C.navy,
  color: "#fff",
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  padding: "8px 5px",
  textAlign: "center",
  lineHeight: 1.15,
};
const sub: React.CSSProperties = { fontWeight: 500, fontSize: 8, color: "#BFD0E3", textTransform: "none", letterSpacing: 0 };
const td: React.CSSProperties = {
  fontSize: 11,
  padding: "8px 5px",
  textAlign: "center",
  verticalAlign: "middle",
  borderBottom: `1px solid ${C.line}`,
  color: C.text,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

function Pill({ children, tone }: { children: React.ReactNode; tone: "navy" | "red" | "green" }) {
  const map = { navy: [C.navySoft, C.navy], red: [C.redSoft, C.red], green: [C.greenSoft, C.green] } as const;
  const [bg, fg] = map[tone];
  return (
    <span style={{ display: "inline-block", minWidth: 26, textAlign: "center", padding: "2px 9px", borderRadius: 999, fontWeight: 700, fontSize: 10, lineHeight: "14px", background: bg, color: fg, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function ReportCardDocumentView({
  doc,
  verificationUrl,
  unmapped,
  onOpen,
}: {
  doc: ReportCardDocument;
  verificationUrl?: string | null;
  /** Staff guidance on a draft (per subject id); undefined for students and frozen cards. */
  unmapped?: Record<number, UnmappedMark[]>;
  /** In-app navigation for the guidance links (falls back to plain links). */
  onOpen?: (url: string) => void;
}) {
  const issued = doc.card.status === "approved" || doc.card.status === "published";
  const school = doc.school;
  const logo = school.logo ? LOGOS[school.logo] : undefined;
  const w = doc.scheme.category_weights;
  const showCA = doc.scheme.show_class_average;
  const showT = doc.scheme.show_subject_teacher;
  const showRank = doc.scheme.show_subject_rank !== false;
  const showComp = doc.scheme.show_competence !== false;
  const hasCodes = doc.groups.some((g) => g.subjects.some((s) => s.code));
  const named = doc.groups.some((g) => g.name);
  const cols = 7 + (hasCodes ? 1 : 0) + (showRank ? 1 : 0) + (showCA ? 1 : 0) + (showComp ? 1 : 0);
  const a = doc.attendance;
  const pct = (n: number) => (a.total > 0 ? `${exact((n / a.total) * 100)}%` : "—");
  const bands = [...doc.scheme.bands].sort((x, y) => y.min - x.min);
  const sm = doc.summary;
  const contact = [school.address_line, school.contact_line].filter(Boolean).join("  ·  ");
  const thresholds = doc.scheme.competence_thresholds;
  const [open, setOpen] = useState<Set<number>>(new Set());
  const all = useMemo(() => doc.groups.flatMap((g) => g.subjects), [doc]);
  const marked = all.filter((s) => s.total != null);
  const anyPartial = marked.some((s) => s.weight_covered != null && s.weight_covered < 100);
  const strongest = [...marked].sort((x, y) => (y.total as number) - (x.total as number))[0];
  const attention = marked.filter((s) => s.competent === false || (s.competent == null && s.passed === false));
  const toggle = (id: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // Staff guidance: what's recorded but not mapped, and subjects with nothing mapped.
  const guide = unmapped !== undefined && !issued;
  const itemsOf = (s: DocumentSubject) => (guide ? (unmapped?.[s.subject_id] ?? []) : []);
  const unassessed = guide ? all.filter((s) => s.total == null && s.mapped === false) : [];
  const withUnmapped = guide ? all.filter((s) => itemsOf(s).length > 0) : [];
  const unmappedCount = withUnmapped.reduce((n, s) => n + itemsOf(s).length, 0);
  const expandable = (s: DocumentSubject) => s.total != null || itemsOf(s).length > 0 || (guide && s.total == null);
  const openable = all.filter(expandable);
  const allOpen = openable.length > 0 && openable.every((s) => open.has(s.subject_id));
  const go = (url: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpen) {
      e.preventDefault();
      onOpen(url);
    }
  };

  const competentCount = sm.modules_competent ?? marked.filter((s) => s.competent).length;
  const decided = competentCount + (sm.modules_nyc ?? marked.filter((s) => s.competent === false).length);
  const tiles: Array<{ k: string; v: string; sub?: string }> = [
    { k: "Average", v: sm.average != null ? `${exact(sm.average)}%` : "—", sub: sm.remark ?? undefined },
    ...(doc.scheme.show_position && sm.position != null ? [{ k: "Position in class", v: ordinal(sm.position), sub: `of ${sm.position_of}` }] : []),
    { k: "Grade", v: sm.grade ?? "—" },
    ...(showComp ? [{ k: "Competent", v: `${competentCount}/${decided}`, sub: "modules" }] : [{ k: "Passed", v: `${sm.subjects_passed}/${sm.subjects_counted}` }]),
    ...(showCA && sm.class_average != null ? [{ k: "Class average", v: `${exact(sm.class_average)}%` }] : []),
  ];

  const unmappedPanel = (s: DocumentSubject) => {
    const items = itemsOf(s);
    const mapUrl = items[0]?.map_url ?? `/grades/subjects/${s.subject_id}`;
    const none = s.total == null && s.mapped === false;
    if (!items.length && !none && s.total != null) return null;
    return (
      <div data-testid={`unmapped-${s.subject_id}`} style={{ border: `1px solid #BFDBFE`, background: "#F5F9FF", borderRadius: 12, padding: "10px 12px", marginBottom: s.total != null ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>
              {items.length ? `${plural(items.length, "assessment")} with marks not mapped` : "No assessments mapped for this subject"}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              {items.length
                ? "These marks count nowhere until each is put in CW, HW, MD or EOT."
                : "Nothing on this card counts for it yet. Map its assessments for this term in Grades."}
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
                <span style={{ fontSize: 9, fontWeight: 700, color: C.blue, background: "#EFF6FF", borderRadius: 999, padding: "2px 8px", textAlign: "center" }}>{KIND[it.kind]}</span>
                <a href={`${BASE}${it.url}`} onClick={go(it.url)} title={it.title} style={{ color: C.ink, fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.title}
                  {it.at && (
                    <span style={{ fontWeight: 400, color: C.muted }}>
                      {" "}
                      · {new Date(it.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </a>
                <span style={{ color: C.muted, whiteSpace: "nowrap" }}>{plural(it.recorded, "student")} marked</span>
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

  const detail = (s: DocumentSubject) => {
    const covered = s.weight_covered ?? 100;
    return (
      <tr className="rc-no-print">
        <td colSpan={cols} style={{ padding: "12px 14px 14px", background: "#FBFCFE", borderBottom: `1px solid ${C.line}` }}>
          {unmappedPanel(s)}
          {s.total != null && (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
            <div>
              <div style={cap}>How the mark is worked out</div>
              {CATS.map((c) => {
                const v = s.categories[c];
                return (
                  <div key={c} style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px", alignItems: "center", gap: 8, marginTop: 6, fontSize: 10.5 }}>
                    <span style={{ color: C.muted }}>
                      <strong style={{ color: C.ink }}>{c}</strong> {CAT_NAME[c]}
                    </span>
                    <span style={{ height: 6, borderRadius: 999, background: "#E5EBF2", overflow: "hidden" }}>
                      {v != null && <span style={{ display: "block", height: "100%", width: `${(v / w[c]) * 100}%`, background: C.navy, borderRadius: 999 }} />}
                    </span>
                    <span style={{ textAlign: "right", color: v != null ? C.ink : C.muted }}>{v != null ? `${f1(v)} / ${w[c]}` : "not yet"}</span>
                  </div>
                );
              })}
              {s.points != null && s.total != null && (
                <div style={{ marginTop: 8, fontSize: 10.5, color: C.text }}>
                  {covered < 100 ? (
                    <>
                      <strong>{f1(s.points)}</strong> of the <strong>{covered}</strong> points assessed so far = <strong>{f1(s.total)}%</strong> (categories with no
                      marks yet are left out).
                    </>
                  ) : (
                    <>
                      <strong>{f1(s.points)}</strong> of 100 points = <strong>{f1(s.total)}%</strong>.
                    </>
                  )}
                </div>
              )}
            </div>
            <div>
              <div style={cap}>Against the class</div>
              {s.total != null && (
                <div style={{ position: "relative", height: 26, marginTop: 10 }}>
                  <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 6, borderRadius: 999, background: "#E5EBF2" }} />
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 0,
                      width: `${Math.min(100, s.total)}%`,
                      height: 6,
                      borderRadius: 999,
                      background: s.competent === false ? C.red : C.navy,
                    }}
                  />
                  {s.class_average != null && (
                    <div title={`Class average ${f1(s.class_average)}%`} style={{ position: "absolute", top: 4, left: `${Math.min(100, s.class_average)}%`, width: 2, height: 18, background: C.accent }} />
                  )}
                  {s.threshold != null && (
                    <div title={`Competent from ${s.threshold}%`} style={{ position: "absolute", top: 6, left: `${s.threshold}%`, width: 1, height: 14, background: C.muted, opacity: 0.6 }} />
                  )}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 10.5, color: C.text, marginTop: 4 }}>
                {s.total != null && (
                  <span>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.navy, marginRight: 4 }} />
                    Student {f1(s.total)}%
                  </span>
                )}
                {s.class_average != null && (
                  <span>
                    <span style={{ display: "inline-block", width: 2, height: 10, background: C.accent, marginRight: 4, verticalAlign: "middle" }} />
                    Class {f1(s.class_average)}%
                  </span>
                )}
                {s.threshold != null && <span>Competent from {s.threshold}%</span>}
                {s.rank != null && <span>{ordinal(s.rank)} of {s.rank_of} in the class</span>}
              </div>
              {s.teacher && <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>Teacher: {s.teacher}</div>}
            </div>
          </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div
      id="report-card-document"
      data-testid="report-card-document"
      style={{
        width: 794,
        minHeight: 1123,
        background: "#fff",
        color: C.text,
        fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
        padding: "34px 38px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @media print { .rc-no-print { display: none !important; } }
        .rc-row { cursor: pointer; transition: background-color .12s ease; }
        .rc-row:hover { background: #F1F5FB !important; }
      `}</style>
      {!issued && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            transform: "rotate(-35deg)",
            fontSize: 110,
            fontWeight: 800,
            color: "rgba(180,35,24,0.06)",
            letterSpacing: 10,
          }}
        >
          PROVISIONAL
        </div>
      )}

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        {logo ? (
          <img src={logo} alt={school.name} style={{ height: 74, width: "auto", display: "block" }} />
        ) : (
          <div style={{ fontSize: 20, fontWeight: 800, color: C.navy }}>{school.name}</div>
        )}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy, letterSpacing: 0.4 }}>STUDENT REPORT CARD</div>
          <div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>
            {doc.card.term} · {doc.card.academic_year}
          </div>
          {contact && <div style={{ fontSize: 9.5, color: C.muted, marginTop: 6 }}>{contact}</div>}
        </div>
      </header>
      <div style={{ position: "relative", height: 3, background: C.navy, marginTop: 10 }}>
        <span style={{ position: "absolute", left: 0, top: 0, height: 3, width: 60, background: C.accent }} />
      </div>

      {/* Student */}
      <section style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr 1.3fr", gap: 12, background: C.navySoft, borderRadius: 12, padding: "11px 16px", marginTop: 16 }}>
        {(
          [
            ["Student", doc.student.name],
            ["Reg. No.", doc.student.registration_number ?? "—"],
            ["Class", doc.student.class_name ?? "—"],
            ["Programme", doc.student.program_name ?? doc.student.grade_name ?? "—"],
          ] as Array<[string, string]>
        ).map(([k, v]) => (
          <div key={k} style={{ minWidth: 0 }}>
            <div style={cap}>{k}</div>
            <div title={v} style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
          </div>
        ))}
      </section>

      {/* Staff guidance (screen only): marks that count nowhere yet */}
      {guide && (unmappedCount > 0 || unassessed.length > 0) && (
        <div
          className="rc-no-print"
          data-testid="mapping-guide"
          style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid #BFDBFE", background: "#F5F9FF" }}
        >
          <span aria-hidden="true" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, background: C.blue, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>
            !
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>
              {unmappedCount > 0
                ? `${plural(unmappedCount, "assessment")} with marks ${unmappedCount === 1 ? "isn't" : "aren't"} mapped (${plural(withUnmapped.length, "subject")})`
                : `${plural(unassessed.length, "subject")} ${unassessed.length === 1 ? "has" : "have"} no marks mapped`}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
              {unmappedCount > 0 && unassessed.length > 0 ? `${plural(unassessed.length, "subject")} also ${unassessed.length === 1 ? "has" : "have"} nothing mapped. ` : ""}
              Open a subject to see which marks and map them in Grades.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(new Set([...withUnmapped, ...unassessed].map((s) => s.subject_id)))}
            style={{ flexShrink: 0, border: "1px solid #BFDBFE", background: "#fff", color: C.blue, borderRadius: 10, padding: "6px 12px", fontSize: 10.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Show subjects
          </button>
        </div>
      )}

      {/* Highlights + expand (screen only) */}
      {openable.length > 0 && (
        <div className="rc-no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, fontSize: 11 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {strongest && (
              <span style={{ padding: "4px 11px", borderRadius: 999, background: C.greenSoft, color: C.green, fontWeight: 600 }}>
                Strongest: {strongest.name} · {exact(strongest.total)}%
              </span>
            )}
            {attention.length > 0 && (
              <span style={{ padding: "4px 11px", borderRadius: 999, background: C.redSoft, color: C.red, fontWeight: 600 }}>
                Needs attention: {attention.map((x) => x.name).slice(0, 2).join(", ")}
                {attention.length > 2 ? ` +${attention.length - 2}` : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(openable.map((s) => s.subject_id)))}
            style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.navy, borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {allOpen ? "Collapse details" : "Expand all details"}
          </button>
        </div>
      )}

      {/* Modules */}
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, marginTop: 12, tableLayout: "fixed" }}>
        <thead>
          <tr>
            {hasCodes && <th style={{ ...th, textAlign: "left", width: 66, paddingLeft: 10, borderTopLeftRadius: 10 }}>Code</th>}
            <th style={{ ...th, textAlign: "left", paddingLeft: 22, borderTopLeftRadius: hasCodes ? 0 : 10 }}>Module</th>
            {CATS.map((c) => (
              <th key={c} style={{ ...th, width: 38 }} title={CAT_NAME[c]}>
                {c}
                <div style={sub}>/{w[c]}</div>
              </th>
            ))}
            <th style={{ ...th, width: 58 }} title="Mark out of 100">
              Mark<div style={sub}>/100</div>
            </th>
            <th style={{ ...th, width: 46 }}>Grade</th>
            {showRank && (
              <th style={{ ...th, width: 44 }} title="Position in the class for this module">
                Pos.<div style={sub}>in class</div>
              </th>
            )}
            {showCA && (
              <th style={{ ...th, width: 46 }}>
                Class<div style={sub}>avg</div>
              </th>
            )}
            {showComp && <th style={{ ...th, width: 84, borderTopRightRadius: 10 }}>Decision</th>}
          </tr>
        </thead>
        <tbody>
          {doc.groups.length === 0 && (
            <tr>
              <td colSpan={cols} style={{ ...td, fontStyle: "italic", color: C.muted }}>
                No modules recorded for this term.
              </td>
            </tr>
          )}
          {doc.groups.map((g, gi) => {
            const gMarked = g.subjects.filter((x) => x.total != null);
            const gComp = gMarked.filter((x) => x.competent).length;
            return (
              <React.Fragment key={g.name ?? `g${gi}`}>
                {named && (
                  <tr>
                    <td colSpan={cols} style={{ ...td, textAlign: "left", background: C.navySoft, padding: "7px 10px" }}>
                      <span style={{ ...cap, color: C.navy }}>{g.name ?? "Other modules"}</span>
                      <span style={{ float: "right", fontSize: 9.5, color: C.muted, fontWeight: 500 }}>
                        {g.subjects.length} module{g.subjects.length === 1 ? "" : "s"}
                        {showComp && gMarked.length ? ` · ${gComp} of ${gMarked.length} competent` : ""}
                      </span>
                    </td>
                  </tr>
                )}
                {g.subjects.map((s) => {
                  const failing = s.competent === false || (s.competent == null && s.passed === false);
                  const partial = s.total != null && s.weight_covered != null && s.weight_covered < 100;
                  const isOpen = open.has(s.subject_id);
                  const canOpen = expandable(s);
                  const none = s.total == null;
                  const nUnmapped = itemsOf(s).length;
                  return (
                    <React.Fragment key={s.subject_id}>
                      <tr
                        className={canOpen ? "rc-row" : undefined}
                        style={{ background: isOpen ? "#F1F5FB" : "#fff" }}
                        onClick={() => canOpen && toggle(s.subject_id)}
                        aria-expanded={canOpen ? isOpen : undefined}
                        data-testid={`module-${s.subject_id}`}
                      >
                        {hasCodes && <td style={{ ...td, textAlign: "left", paddingLeft: 10, fontSize: 9.5, color: C.muted, letterSpacing: 0.2 }}>{s.code ?? ""}</td>}
                        <td style={{ ...td, textAlign: "left", color: none ? C.muted : C.ink, whiteSpace: "normal" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <span
                              className="rc-no-print"
                              aria-hidden="true"
                              style={{ flex: "0 0 11px", color: C.muted, fontSize: 9, lineHeight: "15px", transition: "transform .15s ease", transform: isOpen ? "rotate(90deg)" : "none", visibility: canOpen ? "visible" : "hidden" }}
                            >
                              ▸
                            </span>
                            <div style={{ minWidth: 0, lineHeight: 1.35 }}>
                              <div style={{ fontWeight: 500 }}>{s.name}</div>
                              {showT && s.teacher && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{s.teacher}</div>}
                              {(s.missing_marks > 0 && !issued) || nUnmapped > 0 || (guide && none && s.mapped === false) ? (
                                <div className="rc-no-print" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                                  {s.missing_marks > 0 && !issued && (
                                    <span style={{ fontSize: 8.5, fontWeight: 600, color: "#B45309", background: "#FEF3C7", borderRadius: 999, padding: "1px 7px" }}>
                                      {plural(s.missing_marks, "mark")} pending
                                    </span>
                                  )}
                                  {nUnmapped > 0 && (
                                    <span data-testid={`unmapped-chip-${s.subject_id}`} style={{ fontSize: 8.5, fontWeight: 600, color: C.blue, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 999, padding: "0 7px" }}>
                                      {nUnmapped} not mapped
                                    </span>
                                  )}
                                  {guide && none && s.mapped === false && nUnmapped === 0 && (
                                    <span style={{ fontSize: 8.5, fontWeight: 600, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "0 7px" }}>Nothing mapped</span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        {CATS.map((c) => (
                          <td key={c} style={td}>
                            {s.categories[c] == null ? dash : exact(s.categories[c])}
                          </td>
                        ))}
                        <td style={{ ...td, fontWeight: 800, fontSize: 12, color: failing ? C.red : C.ink }} title={partial ? "Over the work assessed so far" : undefined}>
                          {none ? (
                            dash
                          ) : (
                            <span style={{ position: "relative" }}>
                              {exact(s.total)}
                              {partial && <span style={{ position: "absolute", left: "100%", top: -3, fontSize: 9, fontWeight: 700, color: C.muted, marginLeft: 1 }}>*</span>}
                            </span>
                          )}
                        </td>
                        <td style={td}>{s.grade ? <Pill tone={failing ? "red" : "navy"}>{s.grade}</Pill> : dash}</td>
                        {showRank && <td style={td}>{s.rank != null ? `${s.rank}/${s.rank_of}` : dash}</td>}
                        {showCA && <td style={{ ...td, color: C.muted }}>{s.class_average != null ? exact(s.class_average) : dash}</td>}
                        {showComp && (
                          <td style={td}>
                            {s.competent != null ? (
                              <Pill tone={s.competent ? "green" : "red"}>{s.competent ? "Competent" : "NYC"}</Pill>
                            ) : none ? (
                              <span style={{ fontSize: 9.5, fontStyle: "italic", color: C.muted }}>Not assessed</span>
                            ) : null}
                          </td>
                        )}
                      </tr>
                      {isOpen && detail(s)}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {anyPartial && (
        <div style={{ fontSize: 9, color: C.muted, fontStyle: "italic", marginTop: 4 }}>* Mark over the work assessed so far (categories with no marks yet are left out).</div>
      )}

      {/* Summary */}
      <section style={{ display: "grid", gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: 10, marginTop: 16 }}>
        {tiles.map((t, i) => (
          <div key={t.k} style={{ borderRadius: 12, padding: "10px 14px", background: i === 0 ? C.navy : C.navySoft, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 58 }}>
            <div style={{ ...cap, color: i === 0 ? "#BFD0E3" : C.muted }}>{t.k}</div>
            <div style={{ marginTop: 3, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 21, fontWeight: 800, color: i === 0 ? "#fff" : C.navy }}>{t.v}</span>
              {t.sub && <span style={{ fontSize: 10, color: i === 0 ? "#DCE6F2" : C.muted }}>{t.sub}</span>}
            </div>
          </div>
        ))}
      </section>

      {/* Attendance + attributes */}
      <section style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: 28, marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", alignSelf: "start" }}>
          <thead>
            <tr>
              <th style={{ ...cap, textAlign: "left", paddingBottom: 4 }}>Attendance</th>
              <th style={{ ...cap, paddingBottom: 4 }}>Days</th>
              <th style={{ ...cap, paddingBottom: 4 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Present", a.present],
                ["Absent", a.absent],
                ["Excused", a.excused],
                ["Late", a.late],
                ["Sick", a.sick],
              ] as Array<[string, number]>
            ).map(([k, n]) => (
              <tr key={k}>
                <td style={{ ...td, textAlign: "left", padding: "4px 0" }}>{k}</td>
                <td style={{ ...td, fontWeight: 700, color: C.ink, padding: "4px 0" }}>{n}</td>
                <td style={{ ...td, color: C.muted, padding: "4px 0" }}>{pct(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ width: "100%", borderCollapse: "collapse", alignSelf: "start" }}>
          <thead>
            <tr>
              <th style={{ ...cap, textAlign: "left", paddingBottom: 4 }}>General attributes</th>
              {RATINGS.map((r) => (
                <th key={r} style={{ ...cap, width: 70, paddingBottom: 4 }}>
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.attributes.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "left", fontStyle: "italic", color: C.muted, padding: "4px 0" }}>
                  Not rated.
                </td>
              </tr>
            )}
            {doc.attributes.map((attr) => (
              <tr key={attr.attribute_name}>
                <td style={{ ...td, textAlign: "left", padding: "4px 0" }}>{attr.attribute_name}</td>
                {RATINGS.map((r) => (
                  <td key={r} style={{ ...td, padding: "4px 0" }} aria-label={attr.rating === r ? `${attr.attribute_name}: ${r}` : undefined}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 9,
                        height: 9,
                        borderRadius: 999,
                        background: attr.rating === r ? C.navy : "transparent",
                        border: `1.2px solid ${attr.rating === r ? C.navy : C.line}`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Comment title="Class teacher's comment" text={doc.comments.class_teacher} />
      {doc.comments.head_teacher?.trim() && <Comment title={`${doc.scheme.head_title}'s comment`} text={doc.comments.head_teacher} />}

      {/* Grading scale + key */}
      <div style={{ ...cap, marginTop: 14 }}>Grading scale</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${bands.length}, 1fr)`, gap: 4, marginTop: 5 }}>
        {bands.map((b, i) => (
          <div key={b.letter} style={{ textAlign: "center", padding: "5px 0", borderRadius: 8, background: C.navySoft }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.navy }}>{b.letter}</div>
            <div style={{ fontSize: 8.5, color: C.muted }}>
              {b.min}–{i === 0 ? 100 : bands[i - 1].min - 1}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8.5, color: C.muted, marginTop: 5 }}>
        CW Class work · HW Homework · MD Midterm · EOT End of term exam · Pos. position in class
        {showComp && thresholds ? ` · Competent: specific modules ${thresholds.specific}%+, general/complementary ${thresholds.general}%+ · NYC: not yet competent` : ""}
      </div>

      {doc.next_term_begins_on && (
        <div style={{ textAlign: "center", fontWeight: 700, color: C.navy, fontSize: 12, marginTop: 14 }}>
          Next term begins on{" "}
          {new Date(`${doc.next_term_begins_on}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
        </div>
      )}

      {/* Signatures + verification */}
      <footer style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 18, alignItems: "end" }}>
        <Signature label="Class teacher" />
        <Signature label={doc.scheme.head_title} />
        {issued ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ minWidth: 0, textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.navy }}>Verify this report card</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                Version {doc.card.version}
                {doc.card.approved_at ? `, approved ${new Date(doc.card.approved_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}
              </div>
              {verificationUrl && <div style={{ fontSize: 8, color: C.navy, marginTop: 2, wordBreak: "break-all" }}>{verificationUrl}</div>}
            </div>
            {verificationUrl && <QRCodeSVG value={verificationUrl} size={60} fgColor={C.navy} data-testid="verify-qr" />}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: C.red, fontStyle: "italic", textAlign: "right" }}>
            Provisional — {statusMeta(doc.card.status).label.toLowerCase()}, not yet approved. This document can't be verified.
          </div>
        )}
      </footer>
    </div>
  );
}

function Comment({ title, text }: { title: string; text: string | null }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, marginTop: 12, padding: "10px 14px", minHeight: 48 }}>
      <div style={cap}>{title}</div>
      <div style={{ fontSize: 11.5, marginTop: 4, whiteSpace: "pre-wrap", color: C.text }}>{text?.trim() || "—"}</div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 26 }}>
      <div style={{ borderTop: `1px solid ${C.muted}`, paddingTop: 4, fontSize: 10, color: C.muted }}>{label}</div>
    </div>
  );
}

export default ReportCardDocumentView;
