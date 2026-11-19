import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { DocumentSubject, ReportCardDocument } from "../../services/reportCardApi";
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
 */

const C = {
  navy: "#16324F",
  navySoft: "#EAF0F7",
  ink: "#0F172A",
  text: "#1E293B",
  muted: "#64748B",
  line: "#D5DEE9",
  zebra: "#F7F9FC",
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
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

const cap: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.muted };
const th: React.CSSProperties = {
  background: C.navy,
  color: "#fff",
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  padding: "7px 6px",
  textAlign: "center",
  lineHeight: 1.15,
};
const sub: React.CSSProperties = { fontWeight: 500, fontSize: 8, color: "#BFD0E3", textTransform: "none", letterSpacing: 0 };
const td: React.CSSProperties = {
  fontSize: 11,
  padding: "6px 6px",
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
    <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 999, fontWeight: 800, fontSize: 10, background: bg, color: fg, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function ReportCardDocumentView({ doc, verificationUrl }: { doc: ReportCardDocument; verificationUrl?: string | null }) {
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
  const allOpen = marked.length > 0 && marked.every((s) => open.has(s.subject_id));
  let zebra = 0;

  const competentCount = sm.modules_competent ?? marked.filter((s) => s.competent).length;
  const decided = competentCount + (sm.modules_nyc ?? marked.filter((s) => s.competent === false).length);
  const tiles: Array<{ k: string; v: string; sub?: string }> = [
    { k: "Average", v: sm.average != null ? `${exact(sm.average)}%` : "—", sub: sm.remark ?? undefined },
    ...(doc.scheme.show_position && sm.position != null ? [{ k: "Position in class", v: ordinal(sm.position), sub: `of ${sm.position_of}` }] : []),
    { k: "Grade", v: sm.grade ?? "—" },
    ...(showComp ? [{ k: "Competent", v: `${competentCount}/${decided}`, sub: "modules" }] : [{ k: "Passed", v: `${sm.subjects_passed}/${sm.subjects_counted}` }]),
    ...(showCA && sm.class_average != null ? [{ k: "Class average", v: `${exact(sm.class_average)}%` }] : []),
  ];

  const detail = (s: DocumentSubject) => {
    const covered = s.weight_covered ?? 100;
    return (
      <tr className="rc-no-print">
        <td colSpan={cols} style={{ padding: "10px 14px 14px", background: "#FBFCFE", borderBottom: `1px solid ${C.line}` }}>
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
      <section style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr 1.3fr", gap: 12, background: C.navySoft, borderRadius: 8, padding: "10px 14px", marginTop: 14 }}>
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

      {/* Highlights + expand (screen only) */}
      {marked.length > 0 && (
        <div className="rc-no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, fontSize: 11 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {strongest && (
              <span style={{ padding: "3px 10px", borderRadius: 999, background: C.greenSoft, color: C.green, fontWeight: 600 }}>
                Strongest: {strongest.name} · {exact(strongest.total)}%
              </span>
            )}
            {attention.length > 0 && (
              <span style={{ padding: "3px 10px", borderRadius: 999, background: C.redSoft, color: C.red, fontWeight: 600 }}>
                Needs attention: {attention.map((x) => x.name).slice(0, 2).join(", ")}
                {attention.length > 2 ? ` +${attention.length - 2}` : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(marked.map((s) => s.subject_id)))}
            style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.navy, borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {allOpen ? "Collapse details" : "Expand all details"}
          </button>
        </div>
      )}

      {/* Modules */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
        <thead>
          <tr>
            {hasCodes && <th style={{ ...th, textAlign: "left", width: 70, borderTopLeftRadius: 6 }}>Code</th>}
            <th style={{ ...th, textAlign: "left", borderTopLeftRadius: hasCodes ? 0 : 6 }}>Module</th>
            {CATS.map((c) => (
              <th key={c} style={{ ...th, width: 40 }} title={CAT_NAME[c]}>
                {c}
                <div style={sub}>/{w[c]}</div>
              </th>
            ))}
            <th style={{ ...th, width: 54 }} title="Mark out of 100">
              Mark<div style={sub}>/100</div>
            </th>
            <th style={{ ...th, width: 44 }}>Grade</th>
            {showRank && (
              <th style={{ ...th, width: 46 }} title="Position in the class for this module">
                Pos.<div style={sub}>in class</div>
              </th>
            )}
            {showCA && (
              <th style={{ ...th, width: 48 }}>
                Class<div style={sub}>avg</div>
              </th>
            )}
            {showComp && <th style={{ ...th, width: 78, borderTopRightRadius: 6 }}>Decision</th>}
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
                    <td colSpan={cols} style={{ ...td, textAlign: "left", background: C.navySoft, padding: "5px 8px" }}>
                      <span style={{ ...cap, color: C.navy }}>{g.name ?? "Other modules"}</span>
                      <span style={{ float: "right", fontSize: 9.5, color: C.muted }}>
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
                  const bg = zebra++ % 2 ? C.zebra : "#fff";
                  return (
                    <React.Fragment key={s.subject_id}>
                      <tr
                        className="rc-row"
                        style={{ background: isOpen ? "#F1F5FB" : bg }}
                        onClick={() => s.total != null && toggle(s.subject_id)}
                        aria-expanded={s.total != null ? isOpen : undefined}
                        data-testid={`module-${s.subject_id}`}
                      >
                        {hasCodes && <td style={{ ...td, textAlign: "left", fontSize: 9.5, color: C.muted }}>{s.code ?? ""}</td>}
                        <td style={{ ...td, textAlign: "left", color: C.ink, whiteSpace: "normal" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                            <span className="rc-no-print" aria-hidden="true" style={{ flex: "0 0 10px", color: C.muted, fontSize: 9, lineHeight: "15px" }}>
                              {s.total != null ? (isOpen ? "▾" : "▸") : ""}
                            </span>
                            <div style={{ minWidth: 0, lineHeight: 1.35 }}>
                              <div>{s.name}</div>
                              {showT && s.teacher && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{s.teacher}</div>}
                              {s.missing_marks > 0 && !issued && (
                                <div style={{ fontSize: 9, color: "#B45309", fontWeight: 600, marginTop: 1 }}>
                                  {s.missing_marks} mark{s.missing_marks === 1 ? "" : "s"} pending
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {CATS.map((c) => (
                          <td key={c} style={td}>
                            {exact(s.categories[c])}
                          </td>
                        ))}
                        <td style={{ ...td, fontWeight: 800, fontSize: 12, color: failing ? C.red : C.ink }} title={partial ? "Over the work assessed so far" : undefined}>
                          {exact(s.total)}
                          {partial ? "*" : ""}
                        </td>
                        <td style={td}>{s.grade && <Pill tone={failing ? "red" : "navy"}>{s.grade}</Pill>}</td>
                        {showRank && <td style={{ ...td, fontSize: 10.5 }}>{s.rank != null ? `${s.rank}/${s.rank_of}` : ""}</td>}
                        {showCA && <td style={{ ...td, color: C.muted }}>{exact(s.class_average)}</td>}
                        {showComp && (
                          <td style={td}>
                            {s.competent != null && <Pill tone={s.competent ? "green" : "red"}>{s.competent ? "Competent" : "NYC"}</Pill>}
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
      <section style={{ display: "grid", gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: 10, marginTop: 14 }}>
        {tiles.map((t, i) => (
          <div key={t.k} style={{ borderRadius: 8, padding: "9px 12px", background: i === 0 ? C.navy : C.navySoft }}>
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
          <div key={b.letter} style={{ textAlign: "center", padding: "4px 0", borderRadius: 6, background: C.navySoft }}>
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
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 12, padding: "8px 12px", minHeight: 48 }}>
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
