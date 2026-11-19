import React from "react";
import type { ReportCardDocument } from "../../services/reportCardApi";
import { statusMeta } from "../../services/reportCardApi";

/**
 * The report card as issued: the server's ReportCardDocument (a frozen
 * snapshot once approved, a live render while a draft), laid out like the
 * card NGA prints — student block, subjects grouped by module with class
 * average and teacher, the summary, attendance in days, attributes,
 * comments, grading scale, signatures and next-term date. Drafts and
 * reviewed cards carry a PROVISIONAL watermark. A4 at 96 dpi, inline styles
 * so print and screen match.
 */

const C = {
  primary: "#1e3a5f",
  accent: "#2563eb",
  light: "#E8F0FE",
  zebra: "#F7F9FD",
  border: "#C9D3E3",
  text: "#111827",
  muted: "#5B6475",
  fail: "#B42318",
};

const CATS = ["CW", "HW", "MD", "EOT"] as const;
const RATINGS = ["Excellent", "Very good", "Good"];
const fmt0 = (n: number | null | undefined) => (n == null ? "" : String(Math.round(n)));

const th: React.CSSProperties = {
  background: C.light,
  color: C.primary,
  fontWeight: 700,
  fontSize: 10,
  padding: "6px 6px",
  border: `1px solid ${C.border}`,
  textAlign: "center",
  lineHeight: 1.2,
};
const td: React.CSSProperties = { fontSize: 10.5, padding: "5px 6px", border: `1px solid ${C.border}`, textAlign: "center" };

export function ReportCardDocumentView({
  doc,
  verificationUrl,
}: {
  doc: ReportCardDocument;
  verificationUrl?: string | null;
}) {
  const issued = doc.card.status === "approved" || doc.card.status === "published";
  const w = doc.scheme.category_weights;
  const showCA = doc.scheme.show_class_average;
  const showT = doc.scheme.show_subject_teacher;
  const named = doc.groups.some((g) => g.name);
  const a = doc.attendance;
  const pct = (n: number) => (a.total > 0 ? Math.round((n / a.total) * 100) : null);
  const bands = [...doc.scheme.bands].sort((x, y) => y.min - x.min);
  const cls = [doc.student.class_name, doc.student.program_name ? `(${doc.student.program_name})` : null].filter(Boolean).join(" ");
  const cols = 7 + (showCA ? 1 : 0) + (showT ? 1 : 0);
  let zebra = 0;

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
        padding: "34px 36px",
        boxSizing: "border-box",
        position: "relative",
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
            fontSize: 96,
            fontWeight: 800,
            color: "rgba(217,45,32,0.08)",
            letterSpacing: 8,
          }}
        >
          PROVISIONAL
        </div>
      )}

      {/* Header */}
      <div style={{ background: C.primary, color: "#fff", textAlign: "center", padding: "12px 10px", borderRadius: 2 }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: 0.5 }}>{doc.school.name}</div>
        {doc.school.address_line && <div style={{ fontSize: 10.5, color: "#BFD7FF", marginTop: 2 }}>{doc.school.address_line}</div>}
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>STUDENT ACADEMIC REPORT CARD</div>
      </div>

      {/* Student block */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", margin: "12px 0 10px", fontSize: 11.5 }}>
        <Field label="NAME" value={doc.student.name} />
        <Field label="CLASS" value={cls || "—"} />
        <Field label="REG. NO." value={doc.student.registration_number ?? "—"} />
        <Field label="YEAR" value={`${doc.card.academic_year} - TERM: ${doc.card.term}`} />
      </div>

      {/* Subjects */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>SUBJECT</th>
            {CATS.map((c) => (
              <th key={c} style={{ ...th, width: 42 }}>
                {c}
                <div style={{ fontWeight: 500, color: C.muted, fontSize: 9 }}>/{w[c]}</div>
              </th>
            ))}
            <th style={{ ...th, width: 44 }}>
              TOT<div style={{ fontWeight: 500, color: C.muted, fontSize: 9 }}>/100</div>
            </th>
            <th style={{ ...th, width: 34 }}>GR</th>
            {showCA && <th style={{ ...th, width: 36 }}>CA</th>}
            {showT && <th style={{ ...th, width: 130, textAlign: "left" }}>TEACHER</th>}
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
                  <td colSpan={cols} style={{ ...td, textAlign: "left", fontWeight: 700, color: C.primary, background: "#EEF2F8" }}>
                    {g.name ?? "Other subjects"}
                  </td>
                </tr>
              )}
              {g.subjects.map((s) => {
                const failing = s.passed === false;
                return (
                  <tr key={s.subject_id} style={{ background: zebra++ % 2 ? C.zebra : "#fff" }}>
                    <td style={{ ...td, textAlign: "left" }}>
                      {s.name}
                      {s.missing_marks > 0 && !issued && (
                        <span style={{ color: "#B45309", fontSize: 9, marginLeft: 6 }}>· {s.missing_marks} mark(s) pending</span>
                      )}
                    </td>
                    {CATS.map((c) => (
                      <td key={c} style={td}>
                        {fmt0(s.categories[c])}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 700, color: failing ? C.fail : C.text }}>{fmt0(s.total)}</td>
                    <td style={{ ...td, fontWeight: 700, color: failing ? C.fail : C.text }}>{s.grade ?? ""}</td>
                    {showCA && <td style={td}>{fmt0(s.class_average)}</td>}
                    {showT && <td style={{ ...td, textAlign: "left", fontSize: 9.5 }}>{s.teacher ?? ""}</td>}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
          <tr>
            <td style={{ ...td, textAlign: "left", fontWeight: 800, color: C.primary, background: C.light }}>AVERAGE</td>
            <td colSpan={cols - 1} style={{ ...td, textAlign: "right", fontWeight: 700, color: C.primary, background: C.light }}>
              {[
                doc.summary.average != null ? `${doc.summary.average.toFixed(2)}%` : "—",
                doc.summary.grade ? `Grade ${doc.summary.grade}` : null,
                doc.scheme.show_position && doc.summary.position != null ? `Position ${doc.summary.position} of ${doc.summary.position_of}` : null,
                showCA && doc.summary.class_average != null ? `Class average ${doc.summary.class_average.toFixed(2)}%` : null,
                doc.summary.subjects_counted ? `Passed ${doc.summary.subjects_passed}/${doc.summary.subjects_counted}` : null,
              ]
                .filter(Boolean)
                .join("   ·   ")}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Attendance + attributes */}
      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: 12, marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", alignSelf: "start" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>ATTENDANCE</th>
              <th style={th}>DAYS</th>
              <th style={th}>%</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Present", a.present],
                ["Absent", a.absent],
                ["Excused absence", a.excused],
                ["Late", a.late],
                ["Sick", a.sick],
              ] as Array<[string, number]>
            ).map(([label, n]) => (
              <tr key={label}>
                <td style={{ ...td, textAlign: "left" }}>{label}</td>
                <td style={td}>{n}</td>
                <td style={td}>{pct(n) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ width: "100%", borderCollapse: "collapse", alignSelf: "start" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>GENERAL ATTRIBUTES</th>
              {RATINGS.map((r) => (
                <th key={r} style={{ ...th, width: 64 }}>
                  {r.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.attributes.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...td, fontStyle: "italic", color: C.muted }}>
                  Not rated.
                </td>
              </tr>
            )}
            {doc.attributes.map((attr) => (
              <tr key={attr.attribute_name}>
                <td style={{ ...td, textAlign: "left" }}>{attr.attribute_name}</td>
                {RATINGS.map((r) => (
                  <td key={r} style={{ ...td, color: C.accent, fontWeight: 800 }}>
                    {attr.rating === r ? "✕" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Comment title="CLASS TEACHER'S COMMENT" text={doc.comments.class_teacher} />
      {doc.comments.head_teacher?.trim() && <Comment title={`${doc.scheme.head_title.toUpperCase()}'S COMMENT`} text={doc.comments.head_teacher} />}

      {/* Grading scale */}
      <div style={{ marginTop: 10, fontSize: 9.5, color: C.primary, fontWeight: 700 }}>GRADING SCALE</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${bands.length}, 1fr)`, border: `1px solid ${C.border}`, marginTop: 3 }}>
        {bands.map((b, i) => (
          <div key={b.letter} style={{ textAlign: "center", padding: "3px 0", borderLeft: i ? `1px solid ${C.border}` : undefined }}>
            <div style={{ fontSize: 9, color: C.muted }}>
              {b.min}-{i === 0 ? 100 : bands[i - 1].min - 1}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 800 }}>{b.letter}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>
        CW: Class work · HW: Homework · MD: Midterm · EOT: End of term exam · TOT: Total · GR: Grade{showCA ? " · CA: Class average" : ""}
      </div>

      {/* Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
        <Signature label="Signature of Class Teacher" />
        <Signature label={`Signature of ${doc.scheme.head_title}`} />
      </div>
      {doc.next_term_begins_on && (
        <div style={{ textAlign: "center", fontWeight: 700, color: C.primary, fontSize: 11.5, marginTop: 14 }}>
          Next term begins on{" "}
          {new Date(`${doc.next_term_begins_on}T00:00:00Z`).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
          .
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 6, fontSize: 9, color: C.muted, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>
          {issued
            ? `Version ${doc.card.version} · approved ${doc.card.approved_at ? new Date(doc.card.approved_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : ""}`
            : `Provisional — ${statusMeta(doc.card.status).label.toLowerCase()}, not yet approved`}
        </span>
        {issued && verificationUrl && <span style={{ color: C.accent }}>{verificationUrl}</span>}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
      <span style={{ color: C.muted, fontWeight: 700, width: 66, flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function Comment({ title, text }: { title: string; text: string | null }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, marginTop: 10, padding: "6px 10px", minHeight: 48 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: C.primary }}>{title}</div>
      <div style={{ fontSize: 11, marginTop: 3, whiteSpace: "pre-wrap" }}>{text?.trim() || "—"}</div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div style={{ width: 200, textAlign: "center" }}>
      <div style={{ borderTop: `1px solid ${C.muted}`, paddingTop: 3, fontSize: 9.5, color: C.muted }}>{label}</div>
    </div>
  );
}

export default ReportCardDocumentView;
