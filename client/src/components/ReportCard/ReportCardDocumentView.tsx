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
const CATS = ["CW", "HW", "MD", "EOT", "IA"] as const;
const CAT_NAME: Record<(typeof CATS)[number], string> = { CW: "Class work", HW: "Homework", MD: "Midterm", EOT: "End of term exam", IA: "Integrated (Term 3)" };
/** CAMIS groups modules complementary → core general → core specific. */
const RTB_GROUPS: Array<{ key: "complementary" | "general" | "specific" | null; label: string }> = [
  { key: "complementary", label: "Complementary modules" },
  { key: "general", label: "Core modules — General" },
  { key: "specific", label: "Core modules — Specific" },
  { key: null, label: "Other modules" },
];
const DELIBERATIONS = ["Promoted at 1st sitting", "Promoted after re-assessment", "Re-assessment required", "Advised to repeat", "Dismissed"];
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
  const w = doc.scheme.category_weights as Record<string, number>;
  const showT = doc.scheme.show_subject_teacher;
  const showComp = doc.scheme.show_competence !== false;
  const annual = doc.annual ?? null;
  const finalTerm = !!annual;
  const showRank = doc.scheme.show_subject_rank !== false && !annual;
  const q = doc.qualification;
  const a = doc.attendance;
  const pct = (n: number) => (a.total > 0 ? `${exact((n / a.total) * 100)}%` : "—");
  const sm = doc.summary;
  const thresholds = doc.scheme.competence_thresholds;

  // CAMIS columns: FA (CW+HW+MD), IA (Term 3), CA (EOT), TO per term; Term 3 adds the year.
  const max = { fa: (w.CW ?? 0) + (w.HW ?? 0) + (w.MD ?? 0), ia: w.IA ?? 50, ca: w.EOT ?? 0 };
  const earlierTerms = annual ? annual.terms.slice(0, -1) : [];
  const earlierBehaviour = new Map((doc.behaviour?.earlier ?? []).map((e) => [e.term, e.mark]));
  type Col = { key: string; label: string; sub?: string; group?: string; width?: number; title?: string };
  const termW = annual ? 30 : 48;
  const termCols = (term: string, idx: number, withIA: boolean): Col[] => [
    { key: `fa${idx}`, label: "FA", sub: `/${max.fa}`, group: term, width: termW, title: "Formative assessment (CW+HW+MD)" },
    ...(withIA ? [{ key: `ia${idx}`, label: "IA", sub: `/${max.ia}`, group: term, width: termW, title: "Integrated assessment (Term 3)" }] : []),
    { key: `ca${idx}`, label: "CA", sub: `/${max.ca}`, group: term, width: termW, title: "Comprehensive assessment (end of term)" },
    { key: `to${idx}`, label: "TO", sub: "/100", group: term, width: termW + 6, title: "Term total" },
  ];
  const columns: Col[] = annual
    ? [
        { key: "name", label: "Module" },
        { key: "wt", label: "Wt", sub: "hrs", width: 32, title: "Learning hours" },
        ...earlierTerms.flatMap((t, i) => termCols(t, i, false)),
        ...termCols(doc.card.term, 9, true),
        { key: "at", label: "AT", sub: "/100", group: "Annual", width: 38, title: "Annual total" },
        { key: "re", label: "Re", group: "Annual", width: 26, title: "Re-assessment" },
        ...(showComp ? [{ key: "de", label: "De", group: "Annual", width: 46, title: "Decision" }] : []),
      ]
    : [
        { key: "name", label: "Module" },
        { key: "wt", label: "Weight", sub: "hours", width: 52, title: "Learning hours (credits × 10)" },
        ...termCols(doc.card.term, 9, true),
        ...(showRank ? [{ key: "rk", label: "Pos.", sub: "in class", width: 50, title: "Position in the class for this module" }] : []),
        ...(showComp ? [{ key: "de", label: "Decision", width: 86 }] : []),
      ];
  const cols = columns.length;
  const grouped = columns.some((c) => c.group);
  const headerRow1: Array<{ label: string; sub?: string; span: number; rowSpan: number; width?: number; left?: boolean; title?: string }> = [];
  for (let i = 0; i < columns.length; ) {
    const c = columns[i];
    if (!c.group) {
      headerRow1.push({ label: c.label, sub: c.sub, span: 1, rowSpan: grouped ? 2 : 1, width: c.width, left: c.key === "name", title: c.title });
      i++;
      continue;
    }
    let j = i;
    while (j < columns.length && columns[j].group === c.group) j++;
    headerRow1.push({ label: c.group!, span: j - i, rowSpan: 1 });
    i = j;
  }
  const cellFs: React.CSSProperties = { fontSize: annual ? 9.5 : 11, padding: annual ? "7px 2px" : "8px 5px" };
  const toIdx = columns.findIndex((c) => c.key === "to9");
  const atIdx = columns.findIndex((c) => c.key === "at");
  const rtbGroups = RTB_GROUPS.map((g) => ({
    label: g.label,
    subjects: doc.groups
      .flatMap((x) => x.subjects)
      .filter((x) => (x.category ?? null) === g.key)
      .sort((x, y) => (x.code ?? x.name).localeCompare(y.code ?? y.name)),
  })).filter((g) => g.subjects.length > 0);
  const termCounted = rtbGroups.flatMap((g) => g.subjects).filter((x) => x.total != null).length;
  const summaryRows: Array<{ label: string; term: string; year?: string }> = [
    {
      label: annual ? `Totals (out of ${termCounted * 100 || annual.total_max})` : "Totals",
      term: termCounted ? (annual ? exact(sm.total_marks) : `${exact(sm.total_marks)}/${termCounted * 100}`) : "–",
      year: annual ? (annual.total_max ? `${exact(annual.total_marks)}/${annual.total_max}` : "–") : undefined,
    },
    { label: "Percentage", term: sm.average != null ? `${exact(sm.average)}%` : "–", year: annual ? (annual.average != null ? `${exact(annual.average)}%` : "–") : undefined },
    ...(doc.scheme.show_position
      ? [
          {
            label: "Position",
            term: sm.position != null ? `${sm.position}/${sm.position_of}` : "–",
            year: annual ? (annual.position != null ? `${annual.position}/${annual.position_of}` : "–") : undefined,
          },
        ]
      : []),
  ];
  const compYes = annual ? annual.modules_competent : (sm.modules_competent ?? 0);
  const compNo = annual ? annual.modules_nyc : (sm.modules_nyc ?? 0);
  const deliberations = q?.rqf_level === "5" ? ["Graduated", ...DELIBERATIONS.slice(1)] : DELIBERATIONS;
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
              {CATS.filter((c) => c !== "IA" || finalTerm || s.categories.IA != null).map((c) => {
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

      {/* Header: Republic / Ministry / school · logo (CAMIS) */}
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ lineHeight: 1.45 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>REPUBLIC OF RWANDA</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>MINISTRY OF EDUCATION</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{school.name.toUpperCase()}</div>
          {school.address_line && <div style={{ fontSize: 9.5, color: C.muted }}>{school.address_line}</div>}
          {school.contact_line && <div style={{ fontSize: 9.5, color: C.muted }}>{school.contact_line}</div>}
        </div>
        {logo && <img src={logo} alt={school.name} style={{ height: 70, width: "auto", display: "block" }} />}
      </header>

      {/* Title */}
      <div
        style={{ marginTop: 12, background: C.navy, color: "#fff", borderRadius: 10, padding: "8px 0", textAlign: "center", fontSize: 14, fontWeight: 700, letterSpacing: 1 }}
        data-testid="report-title"
      >
        {finalTerm ? "LEARNER'S ASSESSMENT REPORT" : "LEARNER'S TERMLY ASSESSMENT REPORT"}
      </div>

      {/* Learner + qualification */}
      <section style={{ background: C.navySoft, borderRadius: 12, padding: "10px 14px", marginTop: 10, display: "grid", gap: 8 }}>
        {(
          [
            {
              cols: "1.6fr 1.1fr 0.9fr 1.1fr",
              items: [
                ["Learner's name", doc.student.name],
                ["SDMS ID / Reg. No.", doc.student.registration_number ?? "—"],
                ["Class", doc.student.class_name ?? "—"],
                ["Academic year", finalTerm ? doc.card.academic_year : `${doc.card.academic_year} · ${doc.card.term}`],
              ],
            },
            {
              cols: q?.sector ? "1.6fr 1.1fr 0.9fr 1.1fr" : "1.8fr 1.3fr 0.8fr",
              items: [
                ["Qualification title", q?.title ?? "—"],
                ["Trade", q?.trade ?? doc.student.program_name ?? "—"],
                ["RQF level", q?.rqf_level ? `Level ${q.rqf_level}` : "—"],
                ...(q?.sector ? [["Sector", q.sector]] : []),
              ],
            },
          ] as Array<{ cols: string; items: Array<[string, string]> }>
        ).map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: row.cols, gap: 12 }}>
            {row.items.map(([k, v]) => (
              <div key={k} style={{ minWidth: 0 }}>
                <div style={cap}>{k}</div>
                <div title={v} style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {v}
                </div>
              </div>
            ))}
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

      {/* Modules (RTB / CAMIS): Behaviour, then complementary → core general → core specific */}
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, marginTop: 12, tableLayout: "fixed" }} data-testid="modules-table">
        {/* Explicit widths: the grouped header row can't size a fixed table. */}
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {headerRow1.map((h, i) => (
              <th
                key={i}
                colSpan={h.span}
                rowSpan={h.rowSpan}
                title={h.title}
                style={{
                  ...th,
                  textAlign: h.left ? "left" : "center",
                  paddingLeft: h.left ? 12 : undefined,
                  borderTopLeftRadius: i === 0 ? 10 : 0,
                  borderTopRightRadius: i === headerRow1.length - 1 ? 10 : 0,
                  borderBottom: h.rowSpan === 1 ? "1px solid #3E5A78" : undefined,
                  fontSize: h.rowSpan === 1 ? 8.5 : th.fontSize,
                }}
              >
                {h.label}
                {h.sub && <div style={sub}>{h.sub}</div>}
              </th>
            ))}
          </tr>
          {grouped && (
            <tr>
              {columns
                .filter((c) => c.group)
                .map((c) => (
                  <th key={c.key} style={{ ...th, fontSize: annual ? 8 : 9, padding: annual ? "6px 2px" : th.padding }} title={c.title}>
                    {c.label}
                    {c.sub && <div style={sub}>{c.sub}</div>}
                  </th>
                ))}
            </tr>
          )}
        </thead>
        <tbody>
          {doc.behaviour && (
            <tr data-testid="behaviour-row" style={{ background: "#F4F7FB" }}>
              {columns.map((c) => {
                if (c.key === "name")
                  return (
                    <td key={c.key} style={{ ...td, ...cellFs, textAlign: "left", paddingLeft: 12, fontWeight: 700, color: C.navy }}>
                      Behaviour (Conduct)
                    </td>
                  );
                if (/^to\d+$/.test(c.key)) {
                  const idx = Number(c.key.slice(2));
                  const mark = idx === 9 ? doc.behaviour!.mark : (earlierBehaviour.get(earlierTerms[idx]) ?? null);
                  return (
                    <td key={c.key} style={{ ...td, ...cellFs, fontWeight: 700, color: C.ink }}>
                      {mark != null ? `${exact(mark)}/${doc.behaviour!.max}` : dash}
                    </td>
                  );
                }
                if (c.key === "at") {
                  const marks = [...earlierTerms.map((t) => earlierBehaviour.get(t) ?? null), doc.behaviour!.mark].filter((m): m is number => m != null);
                  return (
                    <td key={c.key} style={{ ...td, ...cellFs, fontWeight: 700, color: C.ink }}>
                      {marks.length ? `${exact(marks.reduce((x, m) => x + m, 0))}/${doc.behaviour!.max * marks.length}` : dash}
                    </td>
                  );
                }
                return <td key={c.key} style={{ ...td, ...cellFs }} />;
              })}
            </tr>
          )}
          {rtbGroups.length === 0 && (
            <tr>
              <td colSpan={cols} style={{ ...td, fontStyle: "italic", color: C.muted }}>
                No modules recorded for this term.
              </td>
            </tr>
          )}
          {rtbGroups.map((g) => {
            const gMarked = g.subjects.filter((x) => (annual ? x.annual?.total : x.total) != null);
            const gComp = gMarked.filter((x) => (annual ? x.annual?.competent : x.competent) === true).length;
            return (
              <React.Fragment key={g.label}>
                <tr>
                  <td colSpan={cols} style={{ ...td, textAlign: "left", background: C.navySoft, padding: "7px 12px" }}>
                    <span style={{ ...cap, color: C.navy }}>{g.label}</span>
                    <span style={{ float: "right", fontSize: 9.5, color: C.muted, fontWeight: 500 }}>
                      {plural(g.subjects.length, "module")}
                      {showComp && gMarked.length ? ` · ${gComp} of ${gMarked.length} competent` : ""}
                    </span>
                  </td>
                </tr>
                {g.subjects.map((s) => {
                  const failing = s.competent === false;
                  const partial = s.total != null && s.weight_covered != null && s.weight_covered < 100;
                  const isOpen = open.has(s.subject_id);
                  const canOpen = expandable(s);
                  const none = s.total == null && s.annual?.total == null;
                  const nUnmapped = itemsOf(s).length;
                  // Cards frozen before the CAMIS columns: split the stored categories here.
                  const sum = (xs: Array<number | null | undefined>) => {
                    const v = xs.filter((x): x is number => x != null);
                    return v.length ? Math.round(v.reduce((p, n) => p + n, 0) * 100) / 100 : null;
                  };
                  const tc = s.term_cell ?? {
                    term: doc.card.term,
                    fa: sum([s.categories.CW, s.categories.HW, s.categories.MD]),
                    ia: s.categories.IA ?? null,
                    ca: s.categories.EOT ?? null,
                    total: s.total,
                  };
                  return (
                    <React.Fragment key={s.subject_id}>
                      <tr
                        className={canOpen ? "rc-row" : undefined}
                        style={{ background: isOpen ? "#F1F5FB" : "#fff" }}
                        onClick={() => canOpen && toggle(s.subject_id)}
                        aria-expanded={canOpen ? isOpen : undefined}
                        data-testid={`module-${s.subject_id}`}
                      >
                        {columns.map((c) => {
                          if (c.key === "name")
                            return (
                              <td key={c.key} style={{ ...td, ...cellFs, textAlign: "left", color: none ? C.muted : C.ink, whiteSpace: "normal" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                                  <span
                                    className="rc-no-print"
                                    aria-hidden="true"
                                    style={{ flex: "0 0 10px", color: C.muted, fontSize: 9, lineHeight: "26px", transition: "transform .15s ease", transform: isOpen ? "rotate(90deg)" : "none", visibility: canOpen ? "visible" : "hidden" }}
                                  >
                                    ▸
                                  </span>
                                  <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                                    {s.code && <div style={{ fontSize: 8.5, fontWeight: 700, color: C.muted, letterSpacing: 0.3 }}>{s.code}</div>}
                                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                                    {showT && s.teacher && <div style={{ fontSize: 8.5, color: C.muted, marginTop: 1 }}>{s.teacher}</div>}
                                    {(s.missing_marks > 0 && !issued) || nUnmapped > 0 || (guide && s.total == null && s.mapped === false) ? (
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
                                        {guide && s.total == null && s.mapped === false && nUnmapped === 0 && (
                                          <span style={{ fontSize: 8.5, fontWeight: 600, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "0 7px" }}>Nothing mapped</span>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            );
                          if (c.key === "wt") return <td key={c.key} style={{ ...td, ...cellFs }}>{s.weight != null ? exact(s.weight) : dash}</td>;
                          if (/^(fa|ia|ca|to)\d+$/.test(c.key)) {
                            const kind = c.key.slice(0, 2) as "fa" | "ia" | "ca" | "to";
                            const idx = Number(c.key.slice(2));
                            const cell = idx === 9 ? tc : ((s.earlier_terms ?? []).find((e) => e.term === earlierTerms[idx]) ?? null);
                            const v = kind === "to" ? (cell?.total ?? null) : (cell?.[kind] ?? null);
                            const na = kind === "ia" && !finalTerm;
                            if (kind === "to")
                              return (
                                <td key={c.key} style={{ ...td, ...cellFs, fontWeight: 800, color: idx === 9 && failing && !annual ? C.red : C.ink }} title={idx === 9 && partial ? "Over the work assessed so far" : undefined}>
                                  {v == null ? (
                                    dash
                                  ) : (
                                    <span style={{ position: "relative" }}>
                                      {exact(v)}
                                      {idx === 9 && partial && <span style={{ position: "absolute", left: "100%", top: -3, fontSize: 8, fontWeight: 700, color: C.muted, marginLeft: 1 }}>*</span>}
                                    </span>
                                  )}
                                </td>
                              );
                            return (
                              <td key={c.key} style={{ ...td, ...cellFs, color: na ? C.muted : C.text, fontSize: na ? 8.5 : cellFs.fontSize }}>
                                {v != null ? exact(v) : na ? "N/A" : dash}
                              </td>
                            );
                          }
                          if (c.key === "at") {
                            const v = s.annual?.total ?? null;
                            return (
                              <td key={c.key} style={{ ...td, ...cellFs, fontWeight: 800, color: s.annual?.competent === false ? C.red : C.ink }}>
                                {v != null ? exact(v) : dash}
                              </td>
                            );
                          }
                          if (c.key === "re") return <td key={c.key} style={{ ...td, ...cellFs }}>{dash}</td>;
                          if (c.key === "rk") return <td key={c.key} style={{ ...td, ...cellFs }}>{s.rank != null ? `${s.rank}/${s.rank_of}` : dash}</td>;
                          if (c.key === "de") {
                            const comp = annual ? (s.annual?.competent ?? null) : s.competent;
                            return (
                              <td key={c.key} style={{ ...td, ...cellFs }}>
                                {comp != null ? (
                                  <Pill tone={comp ? "green" : "red"}>{annual ? (comp ? "C" : "NYC") : comp ? "Competent" : "NYC"}</Pill>
                                ) : none && !annual ? (
                                  <span style={{ fontSize: 9.5, fontStyle: "italic", color: C.muted }}>Not assessed</span>
                                ) : (
                                  dash
                                )}
                              </td>
                            );
                          }
                          return <td key={c.key} style={td} />;
                        })}
                      </tr>
                      {isOpen && detail(s)}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
          {summaryRows.map((r) => (
            <tr key={r.label} data-testid={`summary-${r.label.split(" ")[0].toLowerCase()}`}>
              <td colSpan={toIdx} style={{ ...td, textAlign: "left", paddingLeft: 12, background: C.navySoft, borderBottom: "1px solid #fff" }}>
                <span style={{ ...cap, color: C.navy }}>{r.label}</span>
              </td>
              {annual ? (
                <>
                  <td style={{ ...td, ...cellFs, background: C.navySoft, borderBottom: "1px solid #fff", fontWeight: 800, color: C.ink }}>{r.term}</td>
                  {atIdx - toIdx > 1 && <td colSpan={atIdx - toIdx - 1} style={{ ...td, background: C.navySoft, borderBottom: "1px solid #fff" }} />}
                  <td colSpan={cols - atIdx} style={{ ...td, ...cellFs, background: C.navySoft, borderBottom: "1px solid #fff", fontWeight: 800, color: C.navy, textAlign: "left" }}>
                    {r.year}
                  </td>
                </>
              ) : (
                <td colSpan={cols - toIdx} style={{ ...td, background: C.navySoft, borderBottom: "1px solid #fff", fontWeight: 800, color: C.ink, textAlign: "left" }}>
                  {r.term}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {anyPartial && <div style={{ fontSize: 9, color: C.muted, fontStyle: "italic", marginTop: 4 }}>* Term mark over the work assessed so far (categories with no marks yet are left out).</div>}
      {showComp && (
        <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginTop: 6 }} data-testid="competent-line">
          Competent in {compYes} of {compYes + compNo} module{compYes + compNo === 1 ? "" : "s"}
          {annual ? " over the year" : ""}.
        </div>
      )}

      <Comment title="Class trainer's comment" text={doc.comments.class_teacher} />
      {doc.comments.head_teacher?.trim() && <Comment title={`${doc.scheme.head_title}'s comment`} text={doc.comments.head_teacher} />}

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

      {/* Legend */}
      <div style={{ fontSize: 8.5, color: C.muted, marginTop: 12, lineHeight: 1.5 }} data-testid="legend">
        FA Formative assessment (CW+HW+MD) · IA Integrated assessment (Term 3) · CA Comprehensive assessment (end of term) · TO Term total
        {annual ? " · AT Annual total (average of the terms assessed) · Re Re-assessment · De Decision" : ""} · C Competent · NYC Not Yet Competent · N/A Not applicable ·
        Weight = learning hours (credits × 10)
        {showComp && thresholds ? ` · Competent from ${thresholds.specific}% (specific modules), ${thresholds.general}% (general), ${thresholds.complementary}% (complementary).` : "."}
      </div>

      {doc.next_term_begins_on && (
        <div style={{ textAlign: "center", fontWeight: 700, color: C.navy, fontSize: 12, marginTop: 14 }}>
          Next term begins on{" "}
          {new Date(`${doc.next_term_begins_on}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
        </div>
      )}

      {/* Deliberation (final term) */}
      {finalTerm && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, marginTop: 12, padding: "10px 14px" }} data-testid="deliberation">
          <div style={cap}>Deliberation</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${deliberations.length}, 1fr)`, gap: 8, marginTop: 6 }}>
            {deliberations.map((o) => (
              <span key={o} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.text }}>
                <span style={{ width: 11, height: 11, border: `1.4px solid ${C.navy}`, borderRadius: 3, flexShrink: 0 }} />
                {o}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Signatures, stamp + verification */}
      <footer style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 86px 1.3fr", gap: 16, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 9, color: C.muted, marginBottom: 14 }}>Date: ______________</div>
          <Signature label="Class trainer" />
        </div>
        <Signature label={`School manager (${doc.scheme.head_title})`} />
        <div style={{ height: 62, border: `1px dashed ${C.faint}`, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 8.5, color: C.faint }}>School stamp</div>
        {issued ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ minWidth: 0, textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.navy }}>Verify this report</div>
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
            Provisional — {statusMeta(doc.card.status).label.toLowerCase()}, not yet approved. This report can't be verified.
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
