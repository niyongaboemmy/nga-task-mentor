import React from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ReportCardDocument } from "../../services/reportCardApi";
import { statusMeta } from "../../services/reportCardApi";
import ngaLogo from "../../assets/branding/nga-logo-horizontal.png";

/**
 * The report card as issued: the server's ReportCardDocument (a frozen
 * snapshot once approved, a live render while a draft), in the school's
 * identity — official logo and name, navy brand colour — and the same layout
 * as the PDF (services/reportCardDocumentPdf.ts). A4 at 96 dpi, inline styles
 * so screen and print match. Drafts and reviewed cards carry a PROVISIONAL
 * watermark and no verification code.
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
  accent: "#B03A2E",
};

const LOGOS: Record<string, string> = { nga: ngaLogo };
const CATS = ["CW", "HW", "MD", "EOT"] as const;
const RATINGS = ["Excellent", "Very good", "Good"];
const r0 = (n: number | null | undefined) => (n == null ? "" : String(Math.round(n)));

const cap: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.muted };
const th: React.CSSProperties = {
  background: C.navy,
  color: "#fff",
  fontWeight: 700,
  fontSize: 9.5,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  padding: "7px 8px",
  textAlign: "center",
  lineHeight: 1.15,
};
const td: React.CSSProperties = { fontSize: 11, padding: "6px 8px", textAlign: "center", borderBottom: `1px solid ${C.line}`, color: C.text };

export function ReportCardDocumentView({ doc, verificationUrl }: { doc: ReportCardDocument; verificationUrl?: string | null }) {
  const issued = doc.card.status === "approved" || doc.card.status === "published";
  const school = doc.school as ReportCardDocument["school"] & { contact_line?: string; logo?: string | null };
  const logo = school.logo ? LOGOS[school.logo] : undefined;
  const w = doc.scheme.category_weights;
  const showCA = doc.scheme.show_class_average;
  const showT = doc.scheme.show_subject_teacher;
  const named = doc.groups.some((g) => g.name);
  const cols = 7 + (showCA ? 1 : 0) + (showT ? 1 : 0);
  const a = doc.attendance;
  const pct = (n: number) => (a.total > 0 ? `${Math.round((n / a.total) * 100)}%` : "—");
  const bands = [...doc.scheme.bands].sort((x, y) => y.min - x.min);
  const sm = doc.summary;
  const contact = [school.address_line, school.contact_line].filter(Boolean).join("  ·  ");
  let zebra = 0;

  const tiles: Array<{ k: string; v: string; sub?: string }> = [
    { k: "Average", v: sm.average != null ? `${sm.average.toFixed(1)}%` : "—", sub: sm.remark ?? undefined },
    { k: "Grade", v: sm.grade ?? "—" },
    ...(doc.scheme.show_position && sm.position != null ? [{ k: "Position", v: String(sm.position), sub: `of ${sm.position_of}` }] : []),
    ...(showCA && sm.class_average != null ? [{ k: "Class average", v: `${sm.class_average.toFixed(1)}%` }] : []),
    { k: "Subjects passed", v: `${sm.subjects_passed}/${sm.subjects_counted}` },
  ];

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
        padding: "36px 40px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
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
          <img src={logo} alt={school.name} style={{ height: 76, width: "auto", display: "block" }} />
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
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
          gap: 12,
          background: C.navySoft,
          borderRadius: 8,
          padding: "10px 14px",
          marginTop: 14,
        }}
      >
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
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
          </div>
        ))}
      </section>

      {/* Results */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left", borderTopLeftRadius: 6 }}>Subject</th>
            {CATS.map((c) => (
              <th key={c} style={{ ...th, width: 40 }}>
                {c}
                <div style={{ fontWeight: 500, fontSize: 8.5, color: "#BFD0E3", textTransform: "none" }}>/{w[c]}</div>
              </th>
            ))}
            <th style={{ ...th, width: 46 }}>
              Total<div style={{ fontWeight: 500, fontSize: 8.5, color: "#BFD0E3", textTransform: "none" }}>/100</div>
            </th>
            <th style={{ ...th, width: 52, borderTopRightRadius: !showCA && !showT ? 6 : 0 }}>Grade</th>
            {showCA && (
              <th style={{ ...th, width: 50, borderTopRightRadius: !showT ? 6 : 0 }}>
                Class<div style={{ fontWeight: 500, fontSize: 8.5, color: "#BFD0E3", textTransform: "none" }}>avg</div>
              </th>
            )}
            {showT && <th style={{ ...th, width: 128, textAlign: "left", borderTopRightRadius: 6 }}>Teacher</th>}
          </tr>
        </thead>
        <tbody>
          {doc.groups.length === 0 && (
            <tr>
              <td colSpan={cols} style={{ ...td, fontStyle: "italic", color: C.muted }}>
                No subjects recorded for this term.
              </td>
            </tr>
          )}
          {doc.groups.map((g, gi) => (
            <React.Fragment key={g.name ?? `g${gi}`}>
              {named && (
                <tr>
                  <td colSpan={cols} style={{ ...td, ...cap, textAlign: "left", color: C.navy, background: C.navySoft, padding: "5px 8px" }}>
                    {g.name ?? "Other subjects"}
                  </td>
                </tr>
              )}
              {g.subjects.map((s) => {
                const failing = s.passed === false;
                return (
                  <tr key={s.subject_id} style={{ background: zebra++ % 2 ? C.zebra : "#fff" }}>
                    <td style={{ ...td, textAlign: "left", color: C.ink }}>
                      {s.name}
                      {s.missing_marks > 0 && !issued && (
                        <span style={{ color: "#B45309", fontSize: 9.5, marginLeft: 6 }}>· {s.missing_marks} mark(s) pending</span>
                      )}
                    </td>
                    {CATS.map((c) => (
                      <td key={c} style={td}>
                        {r0(s.categories[c])}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 800, fontSize: 12, color: failing ? C.red : C.ink }}>{r0(s.total)}</td>
                    <td style={td}>
                      {s.grade && (
                        <span
                          style={{
                            display: "inline-block",
                            minWidth: 26,
                            padding: "1px 7px",
                            borderRadius: 999,
                            fontWeight: 800,
                            fontSize: 10.5,
                            background: failing ? C.redSoft : C.navySoft,
                            color: failing ? C.red : C.navy,
                          }}
                        >
                          {s.grade}
                        </span>
                      )}
                    </td>
                    {showCA && <td style={{ ...td, color: C.muted }}>{r0(s.class_average)}</td>}
                    {showT && <td style={{ ...td, textAlign: "left", fontSize: 10, color: C.muted }}>{s.teacher ?? ""}</td>}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <section style={{ display: "grid", gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: 10, marginTop: 16 }}>
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
      <section style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 28, marginTop: 18 }}>
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
                <td style={{ ...td, textAlign: "left", padding: "5px 0" }}>{k}</td>
                <td style={{ ...td, fontWeight: 700, color: C.ink, padding: "5px 0" }}>{n}</td>
                <td style={{ ...td, color: C.muted, padding: "5px 0" }}>{pct(n)}</td>
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
                <td colSpan={4} style={{ ...td, textAlign: "left", fontStyle: "italic", color: C.muted, padding: "5px 0" }}>
                  Not rated.
                </td>
              </tr>
            )}
            {doc.attributes.map((attr) => (
              <tr key={attr.attribute_name}>
                <td style={{ ...td, textAlign: "left", padding: "5px 0" }}>{attr.attribute_name}</td>
                {RATINGS.map((r) => (
                  <td key={r} style={{ ...td, padding: "5px 0" }} aria-label={attr.rating === r ? `${attr.attribute_name}: ${r}` : undefined}>
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

      {/* Grading scale */}
      <div style={{ ...cap, marginTop: 16 }}>Grading scale</div>
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
        CW Class work · HW Homework · MD Midterm · EOT End of term exam{showCA ? " · Class avg: the class's average in the subject" : ""}
      </div>

      {/* Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
        <Signature label="Class teacher" />
        <Signature label={doc.scheme.head_title} />
      </div>
      {doc.next_term_begins_on && (
        <div style={{ textAlign: "center", fontWeight: 700, color: C.navy, fontSize: 12, marginTop: 16 }}>
          Next term begins on{" "}
          {new Date(`${doc.next_term_begins_on}T00:00:00Z`).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.line}`, marginTop: 14, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        {issued ? (
          <>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.navy }}>Verify this report card</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                Version {doc.card.version}
                {doc.card.approved_at
                  ? `, approved ${new Date(doc.card.approved_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                  : ""}
                {` · ${school.name}`}
              </div>
              {verificationUrl && <div style={{ fontSize: 8.5, color: C.navy, marginTop: 2, wordBreak: "break-all" }}>{verificationUrl}</div>}
            </div>
            {verificationUrl && <QRCodeSVG value={verificationUrl} size={64} fgColor={C.navy} data-testid="verify-qr" />}
          </>
        ) : (
          <div style={{ fontSize: 10, color: C.red, fontStyle: "italic", width: "100%", textAlign: "center" }}>
            Provisional — {statusMeta(doc.card.status).label.toLowerCase()}, not yet approved. This document can't be verified.
          </div>
        )}
      </footer>
    </div>
  );
}

function Comment({ title, text }: { title: string; text: string | null }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 14, padding: "8px 12px", minHeight: 52 }}>
      <div style={cap}>{title}</div>
      <div style={{ fontSize: 11.5, marginTop: 4, whiteSpace: "pre-wrap", color: C.text }}>{text?.trim() || "—"}</div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div style={{ width: 210, textAlign: "center" }}>
      <div style={{ borderTop: `1px solid ${C.muted}`, paddingTop: 4, fontSize: 10, color: C.muted }}>{label}</div>
    </div>
  );
}

export default ReportCardDocumentView;
