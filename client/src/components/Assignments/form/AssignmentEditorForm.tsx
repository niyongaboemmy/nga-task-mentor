import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { AxiosProgressEvent } from "axios";
import {
  AlertCircle,
  CalendarClock,
  ClipboardList,
  FileText,
  FileUp,
  Files,
  Keyboard,
  Layers,
  Paperclip,
  RotateCcw,
  Save,
  Trash2,
  Type,
  X,
  Plus,
  Loader2,
  ListChecks,
  Code2,
} from "lucide-react";
import AssignmentDescriptionEditor from "../AssignmentDescriptionEditor";
import FileDropzone from "../../Common/FileDropzone";
import { formatBytes, parseExtensions } from "../../../utils/fileList";
import RubricBuilder from "./RubricBuilder";
import UploadProgressOverlay, { type UploadProgressState } from "./UploadProgressOverlay";
import type { RubricCriterion } from "../AssignmentCard";
import { rubricTotal } from "../../../utils/rubricMarks";
import { parseLocalDateTimeToUTC } from "../../../utils/dateUtils";
import Select from "../../ui/Select";

/** What the server accepts as an assignment attachment (middleware/assignmentUpload.ts). */
export const ATTACHMENT_EXTENSIONS =
  "pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, jpg, jpeg, png, gif, webp, zip, rar, 7z";
export const ATTACHMENT_MAX_MB = 10;
const MAX_ATTACHMENTS = 10;

export interface ExistingAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface AssignmentFormValues {
  title: string;
  description: string;
  /** datetime-local value, in the teacher's own time zone */
  due_date: string;
  max_score: number;
  submission_type: "both" | "file" | "text" | string;
  allowed_file_types: string[];
  rubric: RubricCriterion[];
  course_id: string;
  status: string;
}

interface Props {
  mode: "create" | "edit";
  initial: AssignmentFormValues;
  courses?: { id: string; title: string; code: string }[];
  existingAttachments?: ExistingAttachment[];
  /** Sends the request; reject to keep the form as it is (the error message is shown). */
  submit: (data: FormData, onUploadProgress: (e: AxiosProgressEvent) => void) => Promise<void>;
  onCancel?: () => void;
}

const SUBMISSION_TYPES = [
  { value: "both", label: "File & text", hint: "Upload and/or write", icon: Layers },
  { value: "file", label: "File only", hint: "Students upload files", icon: FileUp },
  { value: "text", label: "Text only", hint: "Students write online", icon: Keyboard },
  { value: "project", label: "TMCode project", hint: "Students code in TMCode", icon: Code2 },
];

/** Submission types where students don't upload files. */
const NO_FILE_TYPES = ["text", "project"];

const FILE_PRESETS: { label: string; types: string[] }[] = [
  { label: "Documents", types: ["pdf", "docx"] },
  { label: "Images", types: ["jpg", "png"] },
  { label: "Archives", types: ["zip", "rar"] },
  { label: "Slides", types: ["pptx"] },
  { label: "Spreadsheets", types: ["xlsx", "csv"] },
  { label: "Web code", types: ["html", "css", "js"] },
];

const STATUSES = [
  { value: "draft", label: "Draft", dot: "bg-gray-400" },
  { value: "published", label: "Published", dot: "bg-emerald-500" },
  { value: "completed", label: "Completed", dot: "bg-blue-500" },
  { value: "removed", label: "Removed", dot: "bg-red-500" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function quickDue(kind: "tomorrow" | "3days" | "week" | "friday"): string {
  const d = new Date();
  if (kind === "tomorrow") d.setDate(d.getDate() + 1);
  if (kind === "3days") d.setDate(d.getDate() + 3);
  if (kind === "week") d.setDate(d.getDate() + 7);
  if (kind === "friday") d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d);
}

function relativeDue(value: string): { text: string; tone: string } | null {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const span = days > 0 ? `${days} day${days > 1 ? "s" : ""}${hours ? ` ${hours} h` : ""}` : `${hours || "<1"} h`;
  if (ms < 0) return { text: `${span} ago`, tone: "text-red-600 dark:text-red-400" };
  return { text: `Due in ${span}`, tone: days < 1 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400" };
}

const inputBase =
  "w-full px-4 py-2.5 border rounded-xl bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition";
const inputCls = (err?: string) =>
  `${inputBase} ${err ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`;

const FieldError: React.FC<{ msg?: string }> = ({ msg }) =>
  msg ? (
    <p className="mt-1 text-xs text-red-500 flex items-center gap-1" role="alert">
      <AlertCircle className="w-3 h-3" /> {msg}
    </p>
  ) : null;

const Label: React.FC<{ children: React.ReactNode; htmlFor?: string; aside?: React.ReactNode }> = ({
  children,
  htmlFor,
  aside,
}) => (
  <div className="flex items-center justify-between mb-1.5">
    <label htmlFor={htmlFor} className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
      {children}
    </label>
    {aside}
  </div>
);

const Section: React.FC<{
  step: number;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ step, icon: Icon, title, subtitle, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: step * 0.05 }}
    className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm"
  >
    <header className="flex items-center gap-3 px-5 sm:px-6 pt-5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</h2>
        {subtitle && <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{subtitle}</p>}
      </div>
    </header>
    <div className="px-5 sm:px-6 pb-6 pt-4">{children}</div>
  </motion.section>
);

/** Chip input for the student-submission file types. Empty = any type. */
const FileTypeChips: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const next = parseExtensions(raw).filter((t) => !value.includes(t));
    if (next.length) onChange([...value, ...next]);
    setDraft("");
  };
  const togglePreset = (types: string[]) => {
    const all = types.every((t) => value.includes(t));
    onChange(all ? value.filter((t) => !types.includes(t)) : [...value, ...types.filter((t) => !value.includes(t))]);
  };
  return (
    <div className="space-y-2.5">
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[44px] px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500"
        data-testid="file-type-chips"
      >
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 pl-2 pr-1 py-0.5 text-xs font-semibold"
          >
            .{t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-800/50"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          aria-label="Add a file type"
          onChange={(e) => {
            const v = e.target.value;
            if (/[,\s]$/.test(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "Add…" : "Any type — or type an extension (e.g. zip) and press Enter"}
          className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none py-1 dark:text-white"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILE_PRESETS.map((p) => {
          const on = p.types.every((t) => value.includes(t));
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => togglePreset(p.types)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition ${
                on
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
              }`}
            >
              {!on && <Plus className="w-3 h-3" />}
              {p.label}
            </button>
          );
        })}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-red-500"
          >
            Allow any type
          </button>
        )}
      </div>
    </div>
  );
};

const AssignmentEditorForm: React.FC<Props> = ({
  mode,
  initial,
  courses,
  existingAttachments = [],
  submit,
  onCancel,
}) => {
  const [values, setValues] = useState<AssignmentFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [kept, setKept] = useState<ExistingAttachment[]>(existingAttachments);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<UploadProgressState | null>(null);

  const set = <K extends keyof AssignmentFormValues>(key: K, v: AssignmentFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  const due = useMemo(() => relativeDue(values.due_date), [values.due_date]);
  const removed = existingAttachments.filter((a) => !kept.some((k) => k.url === a.url));
  const busy = progress !== null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.title.trim()) e.title = "Give the assignment a title";
    if (mode === "create" && !values.course_id) e.course_id = "Choose the course";
    if (!values.description.replace(/<[^>]+>/g, "").trim() && !/<img/i.test(values.description)) {
      e.description = "Write the instructions for students";
    }
    if (!values.due_date) e.due_date = "Set a due date";
    else if (mode === "create" && new Date(values.due_date) <= new Date()) e.due_date = "The due date must be in the future";
    if (!(values.max_score > 0)) e.max_score = "Max score must be greater than 0";
    if (values.rubric.length) {
      if (values.rubric.some((c) => !c.criteria.trim() || !(c.max_score > 0))) {
        e.rubric = "Every criterion needs a name and marks above 0";
      } else if (rubricTotal(values.rubric) > values.max_score + 0.01) {
        e.rubric = `The criteria add up to ${rubricTotal(values.rubric)}, more than the max score (${values.max_score})`;
      }
    }
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.querySelector(`[data-field="${Object.keys(e)[0]}"]`);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy || !validate()) return;
    setServerError("");

    const fd = new FormData();
    fd.append("title", values.title.trim());
    fd.append("description", values.description);
    fd.append("due_date", parseLocalDateTimeToUTC(values.due_date).toISOString().slice(0, 16));
    fd.append("max_score", String(values.max_score));
    fd.append("submission_type", values.submission_type);
    fd.append("allowed_file_types", JSON.stringify(NO_FILE_TYPES.includes(values.submission_type) ? [] : values.allowed_file_types));
    fd.append("rubric", JSON.stringify(values.rubric));
    if (mode === "create") {
      fd.append("course_id", values.course_id);
    } else {
      fd.append("status", values.status);
      fd.append("existing_attachments", JSON.stringify(kept));
    }
    files.forEach((f) => fd.append("attachments", f));

    const totalBytes = files.reduce((a, f) => a + f.size, 0);
    setProgress({ phase: files.length ? "uploading" : "saving", loaded: 0, total: totalBytes, fileCount: files.length });
    try {
      await submit(fd, (e) => {
        const total = e.total || totalBytes;
        const done = e.loaded >= total;
        setProgress({ phase: done ? "saving" : "uploading", loaded: Math.min(e.loaded, total), total, fileCount: files.length });
      });
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setServerError(e?.response?.data?.message || e?.message || "Something went wrong. Please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setProgress(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-5xl mx-auto pb-28" data-testid="assignment-form">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="px-1 pb-5">
        <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
          {mode === "create" ? "Create assignment" : "Edit assignment"}
        </h1>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          {mode === "create"
            ? "Set it up, attach resources and a rubric — it's saved as a draft until you publish it."
            : "Changes apply as soon as you save."}
        </p>
      </motion.div>

      {serverError && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{serverError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setServerError("")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-5">
        {/* 1. Basics */}
        <Section step={1} icon={ClipboardList} title="Basics" subtitle="What it is, for whom, and when it's due">
          <div className="space-y-4">
            <div data-field="title">
              <Label htmlFor="as-title" aside={<span className="text-[11px] text-gray-400">{values.title.length}/255</span>}>
                Title
              </Label>
              <input
                id="as-title"
                type="text"
                maxLength={255}
                value={values.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Practical task: UI design implementation using HTML & CSS"
                className={`${inputCls(errors.title)} text-base font-medium`}
              />
              <FieldError msg={errors.title} />
            </div>

            <div className={`grid grid-cols-1 gap-4 ${mode === "create" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {mode === "create" && (
                <div data-field="course_id">
                  <Label htmlFor="as-course">Course</Label>
                  <Select
                    id="as-course"
                    value={values.course_id}
                    onChange={(e) => set("course_id", e.target.value)}
                    className="w-full"
                    variant="outline"
                    invalid={!!errors.course_id}
                  >
                    <option value="">Select a course</option>
                    {(courses || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.code} — ` : ""}
                        {c.title}
                      </option>
                    ))}
                  </Select>
                  <FieldError msg={errors.course_id} />
                </div>
              )}
              <div data-field="due_date">
                <Label htmlFor="as-due" aside={due && <span className={`text-[11px] font-semibold ${due.tone}`}>{due.text}</span>}>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4" /> Due date & time
                  </span>
                </Label>
                <input
                  id="as-due"
                  type="datetime-local"
                  value={values.due_date}
                  onChange={(e) => set("due_date", e.target.value)}
                  className={inputCls(errors.due_date)}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(
                    [
                      ["tomorrow", "Tomorrow"],
                      ["3days", "In 3 days"],
                      ["friday", "Friday"],
                      ["week", "In a week"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set("due_date", quickDue(k))}
                      className="rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <FieldError msg={errors.due_date} />
              </div>
              <div data-field="max_score">
                <Label htmlFor="as-max">Max score</Label>
                <div className="relative">
                  <input
                    id="as-max"
                    type="number"
                    min={1}
                    max={1000}
                    step="any"
                    value={Number.isFinite(values.max_score) ? values.max_score : ""}
                    onChange={(e) => set("max_score", parseFloat(e.target.value))}
                    className={`${inputCls(errors.max_score)} pr-14 font-semibold`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">marks</span>
                </div>
                <FieldError msg={errors.max_score} />
              </div>
            </div>

            {mode === "edit" && (
              <div>
                <Label>Status</Label>
                <div className="inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1" role="radiogroup" aria-label="Status">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={values.status === s.value}
                      onClick={() => set("status", s.value)}
                      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                        values.status === s.value
                          ? "bg-white dark:bg-gray-900 shadow text-text-primary-light dark:text-text-primary-dark"
                          : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* 2. Submission */}
        <Section step={2} icon={Type} title="How students submit">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5" role="radiogroup" aria-label="Submission type">
            {SUBMISSION_TYPES.map((t) => {
              const on = values.submission_type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("submission_type", t.value)}
                  className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
                    on
                      ? "border-blue-500 bg-blue-50/60 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <t.icon className={`w-5 h-5 mt-0.5 ${on ? "text-blue-600" : "text-gray-400"}`} />
                  <span>
                    <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{t.label}</span>
                    <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {!NO_FILE_TYPES.includes(values.submission_type) && (
            <div className="mt-4">
              <Label>File types students may upload</Label>
              <FileTypeChips value={values.allowed_file_types} onChange={(v) => set("allowed_file_types", v)} />
            </div>
          )}
        </Section>

        {/* 3. Instructions */}
        <Section step={3} icon={FileText} title="Instructions" subtitle="Click to open the editor — paste or drag images straight in">
          <div data-field="description">
            <AssignmentDescriptionEditor
              description={values.description}
              onChange={(content) => set("description", content)}
              placeholder="Describe the task, the steps and what to hand in. You can include the marking criteria here too."
            />
            <FieldError msg={errors.description} />
          </div>
        </Section>

        {/* 4. Rubric */}
        <Section step={4} icon={ListChecks} title="Grading rubric" subtitle="What students are graded on, and how many marks each part is worth">
          <div data-field="rubric">
            <RubricBuilder
              rubric={values.rubric}
              onChange={(r) => set("rubric", r)}
              maxScore={values.max_score}
              onMaxScoreChange={(s) => set("max_score", s)}
              title={values.title}
              description={values.description}
              error={errors.rubric}
            />
          </div>
        </Section>

        {/* 5. Attachments */}
        <Section step={5} icon={Paperclip} title="Resources for students" subtitle="Design images, starter files, handouts…">
          {existingAttachments.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4" data-testid="existing-attachments">
              {existingAttachments.map((att) => {
                const isKept = kept.some((k) => k.url === att.url);
                return (
                  <li
                    key={att.url}
                    className={`flex items-center gap-3 p-2.5 rounded-2xl border transition ${
                      isKept
                        ? "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                        : "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50 opacity-70"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                      <Files className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isKept ? "text-text-primary-light dark:text-text-primary-dark" : "line-through text-gray-500"}`} title={att.name}>
                        {att.name}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {isKept ? formatBytes(att.size || 0) : "Will be removed when you save"}
                      </p>
                    </div>
                    {isKept ? (
                      <button
                        type="button"
                        aria-label={`Remove ${att.name}`}
                        onClick={() => setKept((k) => k.filter((x) => x.url !== att.url))}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Keep ${att.name}`}
                        onClick={() => setKept((k) => [...k, att])}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Undo
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <FileDropzone
            onFilesSelected={setFiles}
            existingFiles={files}
            allowedTypes={ATTACHMENT_EXTENSIONS}
            maxFileSizeMB={ATTACHMENT_MAX_MB}
            maxFiles={Math.max(1, MAX_ATTACHMENTS - kept.length)}
            hint={`PDF, Office, images, text/CSV or archives · up to ${ATTACHMENT_MAX_MB} MB each`}
            disabled={busy}
          />
        </Section>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-40 mt-6 -mx-1">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {files.length > 0 &&
              `${files.length} new file${files.length > 1 ? "s" : ""} (${formatBytes(files.reduce((a, f) => a + f.size, 0))}) will upload on save`}
            {files.length > 0 && removed.length > 0 && " · "}
            {removed.length > 0 && `${removed.length} attachment${removed.length > 1 ? "s" : ""} will be removed`}
          </p>
          <div className="flex gap-2 ml-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {mode === "create" ? "Create assignment" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      <UploadProgressOverlay state={progress} label={mode === "create" ? "Creating the assignment…" : "Saving changes…"} />
    </form>
  );
};

export default AssignmentEditorForm;
