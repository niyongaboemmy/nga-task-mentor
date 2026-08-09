import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Download, Printer, Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReportCardApiService,
  scoreToLetterGrade,
  type ReportCardData,
  type SubjectGrade,
} from "../../services/reportCardApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { short: string; weight: number }> = {
  CW:  { short: "CW",  weight: 15 },
  HW:  { short: "HW",  weight: 10 },
  MD:  { short: "MD",  weight: 25 },
  EOT: { short: "EOT", weight: 50 },
};

const CATEGORY_ORDER = ["CW", "HW", "MD", "EOT"] as const;

const SCHOOL_NAME = "National Grammar Academy";
const SCHOOL_MOTTO = "Excellence · Integrity · Service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportCardPreviewProps {
  studentId: number;
  studentName: string;
  term?: string;
  academicYear?: string;
  /** Maps subject_id → display name. Falls back to "Subject #N". */
  subjectNames?: Record<number, string>;
  /** Called when the user closes the preview */
  onClose: () => void;
  /** Base URL for QR verification link */
  verificationBaseUrl?: string;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function gradeColor(score: number): string {
  if (score >= 90) return "#0d9488"; // teal
  if (score >= 75) return "#2563eb"; // blue
  if (score >= 60) return "#d97706"; // amber
  if (score >= 45) return "#ea580c"; // orange
  return "#dc2626";                  // red
}

function fmt(n: number): string {
  return n.toFixed(2);
}

// ─── Grade row ────────────────────────────────────────────────────────────────

function SubjectRow({
  grade,
  subjectName,
  index,
}: {
  grade: SubjectGrade;
  subjectName: string;
  index: number;
}) {
  const { letter, remark } = scoreToLetterGrade(grade.total_score);

  return (
    <tr
      style={{
        background: index % 2 === 0 ? "#f9fafb" : "#ffffff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <td style={tdStyle}>{subjectName}</td>
      {CATEGORY_ORDER.map((cat) => {
        const res = grade.categories[cat];
        return (
          <td key={cat} style={{ ...tdStyle, textAlign: "center" }}>
            {res ? fmt(res.scaled_score) : "—"}
          </td>
        );
      })}
      <td
        style={{
          ...tdStyle,
          textAlign: "center",
          fontWeight: 700,
          color: gradeColor(grade.total_score),
        }}
      >
        {fmt(grade.total_score)}
      </td>
      <td
        style={{
          ...tdStyle,
          textAlign: "center",
          fontWeight: 700,
          color: gradeColor(grade.total_score),
        }}
      >
        {letter}
      </td>
      <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
        {remark}
      </td>
    </tr>
  );
}

// ─── CSS-in-JS style constants ────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "2px solid #1e3a5f",
  fontSize: 12,
  fontWeight: 700,
  textAlign: "center",
  whiteSpace: "nowrap",
  color: "#1e3a5f",
  background: "#e8f0fe",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: 13,
  verticalAlign: "middle",
};

const attrThStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "2px solid #1e3a5f",
  fontSize: 12,
  fontWeight: 700,
  color: "#1e3a5f",
  background: "#e8f0fe",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const RATING_DOT: Record<string, string> = {
  Excellent:  "#0d9488",
  "Very good": "#2563eb",
  Good:        "#d97706",
};

// ─── Loading skeleton (mimics the A4 document structure) ─────────────────────

function SkeletonBlock({
  w = "100%",
  h = 12,
  rounded = 4,
  mb = 0,
}: {
  w?: string | number;
  h?: number;
  rounded?: number;
  mb?: number;
}) {
  return (
    <div
      className="rc-skeleton"
      style={{
        width: w,
        height: h,
        borderRadius: rounded,
        background: "#e2e8f0",
        marginBottom: mb,
        flexShrink: 0,
      }}
    />
  );
}

function ReportCardSkeleton() {
  return (
    <div
      style={{
        width: 794,
        minHeight: 1123,
        background: "#fff",
        padding: "40px 44px",
        boxSizing: "border-box" as const,
        borderRadius: 4,
        boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <SkeletonBlock w={72} h={72} rounded={36} />
        <div style={{ flex: 1 }}>
          <SkeletonBlock h={22} w="60%" mb={8} />
          <SkeletonBlock h={12} w="40%" mb={8} />
          <SkeletonBlock h={20} w="30%" rounded={20} />
        </div>
        <SkeletonBlock w={100} h={60} rounded={10} />
      </div>

      {/* Student info bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 24,
          padding: "12px 16px",
          background: "#f8fafc",
          borderRadius: 8,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <SkeletonBlock h={10} w="50%" mb={6} />
            <SkeletonBlock h={16} w="80%" />
          </div>
        ))}
      </div>

      {/* Section title */}
      <SkeletonBlock h={16} w="30%" mb={12} />

      {/* Grade table */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
            gap: 8,
            padding: "10px 12px",
            background: "#e8f0fe",
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} h={12} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 4 }).map((_, row) => (
          <div
            key={row}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
              gap: 8,
              padding: "10px 12px",
              background: row % 2 === 0 ? "#f9fafb" : "#fff",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            {Array.from({ length: 8 }).map((_, col) => (
              <SkeletonBlock key={col} h={12} w={col === 0 ? "80%" : "60%"} />
            ))}
          </div>
        ))}
      </div>

      {/* Two-column: attributes + attendance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, marginBottom: 24 }}>
        <div>
          <SkeletonBlock h={16} w="40%" mb={12} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <SkeletonBlock w="45%" h={12} />
              <SkeletonBlock w="25%" h={12} />
            </div>
          ))}
        </div>
        <div style={{ minWidth: 160 }}>
          <SkeletonBlock h={16} w="60%" mb={12} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <SkeletonBlock w={80} h={12} />
              <SkeletonBlock w={40} h={12} />
            </div>
          ))}
        </div>
      </div>

      {/* Comment block */}
      <SkeletonBlock h={16} w="35%" mb={10} />
      <SkeletonBlock h={48} rounded={8} mb={24} />

      {/* Footer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 24, paddingTop: 20, borderTop: "2px solid #e2e8f0" }}>
        <SkeletonBlock h={40} />
        <SkeletonBlock h={40} />
        <SkeletonBlock w={88} h={88} rounded={4} />
      </div>
    </div>
  );
}

// ─── The printable document ───────────────────────────────────────────────────

function ReportCardDocument({
  data,
  studentName,
  subjectNames,
  verificationUrl,
}: {
  data: ReportCardData;
  studentName: string;
  subjectNames: Record<number, string>;
  verificationUrl: string;
}) {
  const rc = data.report_card;
  const att = rc.attendance;

  const averageScore =
    data.grades.length > 0
      ? parseFloat(
          (data.grades.reduce((s, g) => s + g.total_score, 0) / data.grades.length).toFixed(2),
        )
      : 0;

  const { letter: avgLetter, remark: avgRemark } = scoreToLetterGrade(averageScore);

  return (
    <div
      id="report-card-document"
      style={{
        width: 794,        // A4 width in px @ 96dpi
        minHeight: 1123,   // A4 height
        background: "#ffffff",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        color: "#111827",
        padding: "40px 44px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* ── School Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "3px solid #1e3a5f",
          paddingBottom: 20,
          marginBottom: 20,
        }}
      >
        {/* Logo placeholder */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#1e3a5f,#2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>NGA</span>
        </div>

        <div style={{ flex: 1, textAlign: "center", padding: "0 16px" }}>
          <div
            style={{ fontSize: 22, fontWeight: 900, color: "#1e3a5f", letterSpacing: "0.02em" }}
          >
            {SCHOOL_NAME}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, letterSpacing: "0.04em" }}>
            {SCHOOL_MOTTO}
          </div>
          <div
            style={{
              marginTop: 6,
              display: "inline-block",
              background: "#1e3a5f",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 16px",
              borderRadius: 20,
              letterSpacing: "0.06em",
            }}
          >
            ACADEMIC REPORT CARD
          </div>
        </div>

        {/* Term badge */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              border: "2px solid #1e3a5f",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 12,
              lineHeight: 1.6,
              color: "#1e3a5f",
            }}
          >
            <div>
              <strong>Term:</strong> {rc.term}
            </div>
            <div>
              <strong>Year:</strong> {rc.academic_year}
            </div>
          </div>
        </div>
      </div>

      {/* ── Student Info Bar ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 24,
          padding: "12px 16px",
          background: "#f0f4ff",
          borderRadius: 8,
          border: "1px solid #c7d7fd",
        }}
      >
        <InfoField label="Student Name" value={studentName} />
        <InfoField label="Student ID" value={String(rc.student_id)} />
        <InfoField label="Academic Year" value={rc.academic_year} />
      </div>

      {/* ── Grades Table ── */}
      <SectionTitle>Academic Performance</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: "#e8f0fe" }}>
            <th style={{ ...thStyle, textAlign: "left", minWidth: 120 }}>Subject</th>
            {CATEGORY_ORDER.map((cat) => (
              <th key={cat} style={thStyle}>
                {cat}
                <br />
                <span style={{ fontSize: 10, fontWeight: 400, color: "#4b5563" }}>
                  /{CATEGORY_LABELS[cat].weight}
                </span>
              </th>
            ))}
            <th style={thStyle}>Total<br /><span style={{ fontSize: 10, fontWeight: 400 }}>/100</span></th>
            <th style={thStyle}>Grade</th>
            <th style={thStyle}>Remark</th>
          </tr>
        </thead>
        <tbody>
          {data.grades.map((g, i) => (
            <SubjectRow
              key={g.subject_id}
              grade={g}
              subjectName={subjectNames[g.subject_id] ?? `Subject #${g.subject_id}`}
              index={i}
            />
          ))}
          {data.grades.length === 0 && (
            <tr>
              <td
                colSpan={8}
                style={{
                  ...tdStyle,
                  textAlign: "center",
                  color: "#9ca3af",
                  padding: "24px",
                  fontStyle: "italic",
                }}
              >
                No grade data available for this term.
              </td>
            </tr>
          )}
        </tbody>
        {data.grades.length > 0 && (
          <tfoot>
            <tr
              style={{
                background: "#1e3a5f",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              <td style={{ ...tdStyle, color: "#fff", fontWeight: 700 }}>Overall Average</td>
              {CATEGORY_ORDER.map((cat) => (
                <td key={cat} style={{ ...tdStyle, textAlign: "center", color: "#d1d5db" }}>
                  —
                </td>
              ))}
              <td style={{ ...tdStyle, textAlign: "center", color: "#fcd34d", fontSize: 15 }}>
                {fmt(averageScore)}
              </td>
              <td style={{ ...tdStyle, textAlign: "center", color: "#fcd34d", fontSize: 15 }}>
                {avgLetter}
              </td>
              <td style={{ ...tdStyle, textAlign: "center", color: "#93c5fd", fontSize: 12 }}>
                {avgRemark}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* ── Two-column: Attributes + Attendance ── */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, marginBottom: 24 }}
      >
        {/* General Attributes */}
        <div>
          <SectionTitle>General Conduct & Attributes</SectionTitle>
          {data.attributes.length === 0 ? (
            <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: 13, marginTop: 8 }}>
              No attributes recorded.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...attrThStyle, textAlign: "left" }}>Attribute</th>
                  <th style={attrThStyle}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {data.attributes.map((attr, i) => (
                  <tr
                    key={attr.attribute_name}
                    style={{
                      background: i % 2 === 0 ? "#f9fafb" : "#fff",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={tdStyle}>{attr.attribute_name}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color: RATING_DOT[attr.rating] ?? "#374151",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: RATING_DOT[attr.rating] ?? "#9ca3af",
                            display: "inline-block",
                          }}
                        />
                        {attr.rating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Attendance Status — a single term-level status (Present/Absent/Late),
            not a day tally, so no "Total"/"Rate" row is shown (those would
            always read 1 / 100% and imply day-count tracking this form doesn't do). */}
        <div style={{ minWidth: 160 }}>
          <SectionTitle>Attendance Status (Term)</SectionTitle>
          <table
            style={{
              borderCollapse: "collapse",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
              width: "100%",
            }}
          >
            {(
              [
                ["Present", att.present, "#0d9488"],
                ["Absent",  att.absent,  "#dc2626"],
                ["Late",    att.late,    "#d97706"],
              ] as [string, number, string][]
            ).map(([label, val, color], i) => (
              <tr
                key={label}
                style={{
                  background: i % 2 === 0 ? "#f9fafb" : "#fff",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <td
                  style={{
                    padding: "7px 12px",
                    fontSize: 12,
                    color: "#374151",
                  }}
                >
                  {label}
                </td>
                <td
                  style={{
                    padding: "7px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: val ? color : "#d1d5db",
                    textAlign: "center",
                  }}
                >
                  {val ? "✓" : "—"}
                </td>
              </tr>
            ))}
          </table>
        </div>
      </div>

      {/* ── Teacher Comment ── */}
      <SectionTitle>Class Teacher's Comment</SectionTitle>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderLeft: "4px solid #1e3a5f",
          borderRadius: "0 8px 8px 0",
          padding: "12px 16px",
          minHeight: 48,
          marginBottom: 24,
          background: "#f9fafb",
          fontSize: 13,
          color: rc.class_teacher_comment ? "#111827" : "#9ca3af",
          fontStyle: rc.class_teacher_comment ? "normal" : "italic",
        }}
      >
        {rc.class_teacher_comment ?? "No comment provided."}
      </div>

      {/* ── Grade Key ── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 28,
          fontSize: 11,
          color: "#4b5563",
        }}
      >
        {(
          [
            ["A – Distinction", "≥90%", "#0d9488"],
            ["B – Merit",       "75–89%", "#2563eb"],
            ["C – Credit",      "60–74%", "#d97706"],
            ["D – Pass",        "45–59%", "#ea580c"],
            ["F – Fail",        "<45%",   "#dc2626"],
          ] as [string, string, string][]
        ).map(([label, range, color]) => (
          <span
            key={label}
            style={{
              padding: "3px 10px",
              borderRadius: 20,
              border: `1px solid ${color}`,
              color,
              fontWeight: 600,
              fontSize: 10,
            }}
          >
            {label} ({range})
          </span>
        ))}
      </div>

      {/* ── Footer: signatures + QR ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 24,
          alignItems: "flex-end",
          borderTop: "2px solid #e5e7eb",
          paddingTop: 20,
          marginTop: "auto",
        }}
      >
        <SignatureLine label="Class Teacher" />
        <SignatureLine label="Head Teacher / Principal" />

        <div style={{ textAlign: "center" }}>
          <QRCodeSVG
            value={verificationUrl}
            size={88}
            level="M"
            bgColor="#ffffff"
            fgColor="#1e3a5f"
          />
          <div
            style={{
              fontSize: 9,
              color: "#6b7280",
              marginTop: 4,
              maxWidth: 100,
              wordBreak: "break-all",
            }}
          >
            Scan to verify
          </div>
          <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>
            UUID: {rc.uuid.slice(0, 8)}…
          </div>
        </div>
      </div>

      {/* Watermark stripe */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "linear-gradient(90deg,#1e3a5f,#2563eb,#1e3a5f)",
          borderRadius: "0 0 4px 4px",
        }}
      />
    </div>
  );
}

// ─── Small layout helpers ─────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "#1e3a5f",
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        borderBottom: "2px solid #1e3a5f",
        paddingBottom: 4,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div
        style={{
          borderBottom: "1px solid #374151",
          marginBottom: 6,
          height: 36,
        }}
      />
      <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>{label}</div>
    </div>
  );
}

// ─── Shell modal with fetch / download logic ──────────────────────────────────

const A4_PX = 794; // A4 width at 96dpi

function calcAutoZoom(): number {
  const vw = window.innerWidth;
  if (vw < 480)  return Math.max(0.38, (vw - 32) / A4_PX);
  if (vw < 768)  return Math.max(0.5,  (vw - 48) / A4_PX);
  if (vw < 1024) return Math.max(0.65, (vw - 80) / A4_PX);
  return 1.0;
}

export default function ReportCardPreview({
  studentId,
  studentName,
  term,
  academicYear,
  subjectNames = {},
  onClose,
  verificationBaseUrl = window.location.origin,
}: ReportCardPreviewProps) {
  const [data, setData]       = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printMode, setPrintMode]     = useState(false);
  const [zoom, setZoom]               = useState(() => calcAutoZoom());
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const stepZoom = (delta: number) =>
    setZoom((z) => Math.min(1.5, Math.max(0.3, parseFloat((z + delta).toFixed(2)))));

  const resetZoom = () => setZoom(calcAutoZoom());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ReportCardApiService.getStudentReportCard(studentId, {
        term,
        academic_year: academicYear,
      });
      if (res.success) {
        setData(res.data);
      } else {
        setError("Report card not found for the selected term.");
      }
    } catch {
      setError("Failed to load report card. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [studentId, term, academicYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadPdf = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const blob = await ReportCardApiService.generatePdf(data.report_card.id);
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `ReportCard-${studentName.replace(/\s+/g, "_")}-${data.report_card.term}-${data.report_card.academic_year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleBrowserPrint = () => {
    setPrintMode(true);
    requestAnimationFrame(() => {
      window.print();
      setPrintMode(false);
    });
  };

  const verificationUrl = data
    ? `${verificationBaseUrl}/verify/report-card/${data.report_card.uuid}`
    : verificationBaseUrl;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col"
        data-report-card-overlay="true"
        style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      >
        {/* ── Toolbar ── */}
        {!printMode && (
          <div
            data-toolbar="true"
            className="flex items-center justify-between gap-3 px-3 sm:px-5 py-2.5 flex-shrink-0 flex-wrap"
            style={{ background: "#0f172a", borderBottom: "1px solid #1e293b" }}
          >
            {/* Left: title */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-white font-semibold text-sm hidden xs:inline">Report Card</span>
              {data && (
                <span className="text-xs text-slate-400 truncate max-w-[160px] sm:max-w-none">
                  <span className="hidden sm:inline">{studentName} · </span>
                  {data.report_card.term} · {data.report_card.academic_year}
                </span>
              )}
            </div>

            {/* Center: zoom controls */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl px-1 py-1">
              <button
                onClick={() => stepZoom(-0.1)}
                disabled={zoom <= 0.3}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-colors"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-semibold text-slate-300 min-w-[36px] text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => stepZoom(0.1)}
                disabled={zoom >= 1.5}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-colors"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={resetZoom}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="Reset zoom"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleBrowserPrint}
                disabled={!data}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600
                  text-white text-xs font-medium transition-colors disabled:opacity-40"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={!data || downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40
                  shadow-sm shadow-indigo-500/20"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{downloading ? "Generating…" : "Download PDF"}</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Scrollable content area ── */}
        <div
          data-scroll-area="true"
          className="flex-1 overflow-auto flex justify-center py-6 px-4"
          style={{ background: "#1e293b" }}
        >
          {loading && <ReportCardSkeleton />}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center gap-4 text-white/70 my-20">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-red-300 text-center">{error}</p>
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}

          {data && !loading && (
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                marginBottom: zoom < 1 ? `${(zoom - 1) * 1123}px` : 0,
              }}
            >
              <div
                style={{
                  boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <ReportCardDocument
                  data={data}
                  studentName={studentName}
                  subjectNames={{ ...subjectNames, ...data.subject_names }}
                  verificationUrl={verificationUrl}
                />
              </div>
            </div>
          )}
        </div>

        {/* Hidden iframe for browser print */}
        <iframe ref={printFrameRef} style={{ display: "none" }} title="print-frame" />

        {/* Print-specific styles — hides everything except the document */}
        <style>{`
          @media print {
            /* Hide all UI chrome */
            body > * { display: none !important; }
            /* Show only the modal overlay */
            body > div[data-report-card-overlay] { display: flex !important; }

            /* Within the overlay, hide the toolbar */
            [data-toolbar] { display: none !important; }

            /* Reset the scroll container so the document fills the page */
            [data-scroll-area] {
              overflow: visible !important;
              background: #fff !important;
              padding: 0 !important;
            }

            /* The A4 document itself */
            #report-card-document {
              box-shadow: none !important;
              width: 100% !important;
              min-height: unset !important;
              page-break-inside: avoid;
            }

            @page {
              size: A4 portrait;
              margin: 0;
            }
          }

          /* Skeleton pulse animation */
          @keyframes rc-skeleton-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.4; }
          }
          .rc-skeleton {
            animation: rc-skeleton-pulse 1.5s ease-in-out infinite;
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
