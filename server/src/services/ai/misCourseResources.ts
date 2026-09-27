import { Request } from "express";
import axios from "axios";
import { resolveAcademicTermId } from "../../utils/misUtils";
import { DocumentExtractorService } from "../DocumentExtractorService";
import type { GenerationSourcePart } from "./generationContextStore";

/**
 * Teaching resources a subject already has in the MIS, offered to the AI
 * Question Generator as source material instead of an upload:
 *
 *   curriculum    GET /curriculum/subjects/:sid/competencies        (learning outcomes)
 *   weeks         GET /scheme-of-work/entries?subject&class&term     (one row per SoW entry)
 *   lesson_plans  GET /lesson-plans/entry/:entryId                   (bare array, per entry)
 *   notes         GET /lesson-notes?subject_id=  → /lesson-notes/:id (caller's own notes)
 *   materials     GET /curriculum/subjects/:sid/documents → /curriculum/documents/:id/download
 *   elearning     GET /elearning/courses/mine → /elearning/courses/:id (PAGE + KNOWLEDGE_CHECK)
 *
 * Everything goes out with the teacher's own MIS token, so MIS access rules
 * apply. On top of that, every id a client asks to resolve is re-checked
 * against this subject's own listings — a request can't pull a resource that
 * belongs to a different subject just by naming its id.
 */

export class MisResourceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type SourceKind =
  | "competency"
  | "sow_entry"
  | "lesson_plan"
  | "lesson_note"
  | "material"
  | "elearning_item";

export interface SourceItem {
  kind: SourceKind;
  id: string;
  title: string;
  subtitle?: string;
  week?: string | null;
  meta?: string[];
  /** Rough size of the text this resource contributes, for the UI's budget meter. */
  chars_estimate?: number;
  supported: boolean;
  reason?: string;
}

export interface SourceGroup {
  key: "curriculum" | "weeks" | "lesson_plans" | "notes" | "materials" | "elearning";
  label: string;
  status: "ok" | "unavailable";
  message?: string;
  items: SourceItem[];
}

interface Scope {
  subjectName: string | null;
  classGroupId: number | null;
  academicTermId: number | null;
  classGroups: { id: number; name: string }[];
}

const MAX_TOTAL_CHARS = DocumentExtractorService.MAX_CHARS;
const MIN_PART_CHARS = 3000;
const TIMEOUT = 20_000;

const base = () => String(process.env.NGA_MIS_BASE_URL || "").replace(/\/$/, "");

async function misGet<T = any>(token: string, path: string, params?: Record<string, any>) {
  const res = await axios.get(`${base()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    params,
    timeout: TIMEOUT,
  });
  return res.data as T;
}

/** Most MIS endpoints wrap in {success,data}; lesson plans return a bare array. */
const unwrap = (body: any): any => (body && typeof body === "object" && "data" in body ? body.data : body);
const asArray = (v: any): any[] => (Array.isArray(v) ? v : []);

const clean = (s: any) =>
  String(s ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function htmlToText(html: string): string {
  return clean(
    String(html || "")
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

/** Plain text out of a Tiptap/ProseMirror JSON document. */
export function tiptapToText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") {
    try {
      return tiptapToText(JSON.parse(node));
    } catch {
      return node;
    }
  }
  if (Array.isArray(node)) return node.map(tiptapToText).join("");
  if (node.type === "text") return String(node.text || "");
  if (node.type === "hardBreak") return "\n";
  const inner = tiptapToText(node.content || []);
  const block = ["paragraph", "heading", "listItem", "blockquote", "codeBlock", "tableRow"];
  return block.includes(node.type) ? `${inner}\n` : inner;
}

const line = (label: string, value: any) => {
  const v = clean(value);
  return v ? `${label}: ${v}` : "";
};
const joinLines = (...ls: string[]) => ls.filter(Boolean).join("\n");
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---------------------------------------------------------------- scope

async function resolveScope(
  req: Request,
  token: string,
  courseId: number,
  opts: { classGroupId?: number; academicTermId?: number },
): Promise<Scope> {
  const academicTermId = opts.academicTermId || (await resolveAcademicTermId(req)) || null;

  let rows: any[] = [];
  try {
    rows = asArray(
      unwrap(
        await misGet(token, "/academics/my-assigned-subjects", academicTermId ? { academic_term_id: academicTermId } : {}),
      ),
    ).filter((s) => Number(s.subject_id ?? s.id) === courseId);
  } catch {
    rows = []; // not a teacher (e.g. an admin) — fall back to the subject record below
  }

  const classGroups = new Map<number, string>();
  let subjectName: string | null = null;
  for (const r of rows) {
    subjectName = subjectName || r.subject_name || r.name || null;
    const id = Number(r.class_group_id ?? r.grades?.[0]?.class_group_id);
    if (id) classGroups.set(id, r.class_group_name || r.grades?.[0]?.class_group_name || `Class ${id}`);
  }

  if (!classGroups.size) {
    try {
      const s = unwrap(await misGet(token, `/academics/subjects/${courseId}`));
      const subject = Array.isArray(s) ? s[0] : s;
      subjectName = subjectName || subject?.name || null;
      const id = Number(subject?.class_group_id ?? subject?.grades?.[0]?.class_group_id);
      if (id) classGroups.set(id, subject?.class_group_name || `Class ${id}`);
    } catch {
      /* no class group — scheme-based groups will say so */
    }
  }

  const list = [...classGroups].map(([id, name]) => ({ id, name }));
  const classGroupId =
    opts.classGroupId && (classGroups.has(opts.classGroupId) || !list.length)
      ? opts.classGroupId
      : list[0]?.id ?? null;

  return { subjectName, classGroupId, academicTermId, classGroups: list };
}

// ---------------------------------------------------------------- raw fetchers

async function fetchCompetencies(token: string, courseId: number) {
  return asArray(unwrap(await misGet(token, `/curriculum/subjects/${courseId}/competencies`)));
}

async function fetchSowEntries(token: string, courseId: number, scope: Scope) {
  if (!scope.classGroupId || !scope.academicTermId) {
    throw new MisResourceError(400, "No class group or term found for this subject.");
  }
  const data = unwrap(
    await misGet(token, "/scheme-of-work/entries", {
      subject_id: courseId,
      class_group_id: scope.classGroupId,
      academic_term_id: scope.academicTermId,
    }),
  );
  return asArray(Array.isArray(data) ? data : data?.entries);
}

async function fetchLessonPlans(token: string, entryId: number) {
  return asArray(unwrap(await misGet(token, `/lesson-plans/entry/${entryId}`)));
}

async function fetchDocuments(token: string, courseId: number) {
  return asArray(unwrap(await misGet(token, `/curriculum/subjects/${courseId}/documents`)));
}

async function fetchCourseTree(token: string, elearningCourseId: number) {
  return unwrap(await misGet(token, `/elearning/courses/${elearningCourseId}`));
}

async function findElearningCourses(token: string, courseId: number, scope: Scope) {
  const mine = asArray(unwrap(await misGet(token, "/elearning/courses/mine")));
  return mine.filter(
    (c) =>
      Number(c.subject_id) === courseId &&
      (!scope.classGroupId || Number(c.class_group_id) === scope.classGroupId),
  );
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------------------------------------------------------------- text builders

function competencyText(c: any): string {
  return joinLines(
    `LEARNING OUTCOME ${c.element_number ?? ""}: ${clean(c.title)}`,
    line("Description", c.description),
    line("Indicative content", htmlToText(c.indicative_content || "")),
    asArray(c.criteria).length
      ? `Performance criteria:\n${asArray(c.criteria)
          .map((k) => `- ${k.criteria_number ?? ""} ${clean(k.description)}`)
          .join("\n")}`
      : "",
  );
}

function sowEntryText(e: any): string {
  return joinLines(
    `SCHEME OF WORK — Week ${clean(e.week_number) || "?"}: ${clean(e.topic)}`,
    line("Learning outcome", e.competency?.title),
    line("Sub-topic", e.sub_topic),
    line("Objective", e.objective),
    line("Methodology", e.methodology),
    line("Resources", e.resources),
    line("Evaluation", e.evaluation),
    asArray(e.criteria).length
      ? `Criteria:\n${asArray(e.criteria).map((k) => `- ${clean(k.description)}`).join("\n")}`
      : "",
  );
}

function lessonPlanText(p: any): string {
  const outcomes = asArray(p.outcomes).map((o) =>
    joinLines(
      `${clean(o.code)} ${clean(o.title)}`,
      line("  Description", o.description),
      ...asArray(o.activities).map((a) =>
        joinLines(line("  Trainer activity", a.trainer_activities), line("  Learner activity", a.learner_activities)),
      ),
    ),
  );
  const sections = asArray(p.sections).map((s) =>
    joinLines(
      `${clean(s.section_type)}:`,
      line("  Trainer", s.trainer_activities),
      line("  Learners", s.learner_activities),
    ),
  );
  return joinLines(
    `LESSON PLAN — Week ${p.week ?? "?"}${p.module_name ? ` (${clean(p.module_name)})` : ""}`,
    line("Big question", p.big_question),
    outcomes.length ? `Learning outcomes:\n${outcomes.join("\n")}` : "",
    asArray(p.indicativeContent).length
      ? `Indicative content:\n${asArray(p.indicativeContent)
          .map((i) => `- ${clean(i.category)}: ${clean(i.content)}`)
          .join("\n")}`
      : "",
    sections.length ? `Lesson flow:\n${sections.join("\n")}` : "",
    asArray(p.assignments).length
      ? `Assignments:\n${asArray(p.assignments).map((a) => `- ${clean(a.description)}`).join("\n")}`
      : "",
    line("Teacher notes", p.evaluation?.teacher_notes),
  );
}

function knowledgeCheckText(json: any): string {
  const qs = asArray(json?.questions);
  return qs
    .map((q, i) => {
      const opts = asArray(q.options);
      const right = opts[Number(q.correct_index)];
      return joinLines(
        `Q${i + 1}. ${clean(q.prompt)}`,
        opts.length ? `Options: ${opts.map(clean).join(" | ")}` : "",
        right !== undefined ? `Answer: ${clean(right)}` : "",
        line("Why", q.explanation),
      );
    })
    .join("\n");
}

function elearningItemText(item: any): string {
  const body =
    item.item_type === "KNOWLEDGE_CHECK"
      ? knowledgeCheckText(typeof item.content_json === "string" ? safeJson(item.content_json) : item.content_json)
      : tiptapToText(item.content_json);
  return joinLines(`E-LEARNING ${item.item_type === "PAGE" ? "PAGE" : "KNOWLEDGE CHECK"}: ${clean(item.title)}`, line("Summary", item.description), clean(body));
}

const safeJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const EXTRACTABLE = /\.(pdf|docx)$/i;
const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// ---------------------------------------------------------------- listing

async function group(
  key: SourceGroup["key"],
  label: string,
  load: () => Promise<SourceItem[]>,
): Promise<SourceGroup> {
  try {
    return { key, label, status: "ok", items: await load() };
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status;
    // Let an expired MIS session surface as a 401 for the whole request.
    if (status === 401) throw err;
    const message =
      status === 403
        ? "You don't have access to these in the MIS."
        : err instanceof MisResourceError
          ? err.message
          : "Couldn't load these from the MIS right now.";
    return { key, label, status: "unavailable", message, items: [] };
  }
}

export async function listCourseResources(
  req: Request,
  token: string,
  courseId: number,
  opts: { classGroupId?: number; academicTermId?: number },
) {
  const scope = await resolveScope(req, token, courseId, opts);
  const entriesP = fetchSowEntries(token, courseId, scope);
  entriesP.catch(() => undefined); // awaited by two groups below; avoid an unhandled rejection

  const groups = await Promise.all([
    group("curriculum", "Curriculum outcomes", async () =>
      (await fetchCompetencies(token, courseId)).map((c) => {
        const text = competencyText(c);
        return {
          kind: "competency" as const,
          id: String(c.competency_id),
          title: clean(c.title) || `Outcome ${c.element_number}`,
          subtitle: truncate(clean(c.description || htmlToText(c.indicative_content || "")), 140),
          meta: [
            c.element_number ? `LO ${c.element_number}` : "",
            asArray(c.criteria).length ? `${asArray(c.criteria).length} criteria` : "",
            c.learning_hours ? `${c.learning_hours} h` : "",
          ].filter(Boolean),
          chars_estimate: text.length,
          supported: text.length > 40,
          reason: text.length > 40 ? undefined : "No description yet",
        };
      }),
    ),
    group("weeks", "Scheme of work weeks", async () =>
      (await entriesP).map((e) => {
        const text = sowEntryText(e);
        return {
          kind: "sow_entry" as const,
          id: String(e.entry_id),
          title: clean(e.topic) || "Untitled topic",
          subtitle: truncate(clean(e.objective || e.sub_topic), 140),
          week: clean(e.week_number) || null,
          meta: [e.entry_status ? String(e.entry_status).toLowerCase() : "", e.competency?.title ? truncate(clean(e.competency.title), 40) : ""].filter(Boolean),
          chars_estimate: text.length,
          supported: true,
        };
      }),
    ),
    group("lesson_plans", "Lesson plans", async () => {
      const entries = await entriesP;
      const perEntry = await mapLimit(entries, 6, async (e) => {
        try {
          return { e, plans: await fetchLessonPlans(token, Number(e.entry_id)) };
        } catch {
          return { e, plans: [] };
        }
      });
      return perEntry.flatMap(({ e, plans }) =>
        plans.map((p: any) => {
          const text = lessonPlanText(p);
          return {
            kind: "lesson_plan" as const,
            id: `${e.entry_id}:${p.id}`,
            title: clean(p.big_question) || clean(e.topic) || "Lesson plan",
            subtitle: truncate(asArray(p.outcomes).map((o: any) => clean(o.title)).join(" · "), 140),
            week: clean(p.week ?? e.week_number) || null,
            meta: [p.session_code ? clean(p.session_code) : "", p.lesson_date ? String(p.lesson_date).slice(0, 10) : ""].filter(Boolean),
            chars_estimate: text.length,
            supported: true,
          };
        }),
      );
    }),
    group("notes", "My lesson notes", async () => {
      const notes = asArray(unwrap(await misGet(token, "/lesson-notes", { subject_id: courseId })));
      return notes
        .filter((n) => Number(n.subject_id) === courseId)
        .map((n) => ({
          kind: "lesson_note" as const,
          id: String(n.note_id),
          title: clean(n.title) || "Untitled note",
          subtitle: [n.class_group_name, n.file_name].filter(Boolean).join(" · "),
          meta: [String(n.status || "").toLowerCase(), n.source === "PDF_UPLOAD" ? `PDF${n.page_count ? ` · ${n.page_count} p` : ""}` : "rich text"].filter(Boolean),
          supported: true,
        }));
    }),
    group("materials", "Shared materials", async () =>
      (await fetchDocuments(token, courseId)).map((d) => {
        const name = String(d.original_name || d.file_name || "document");
        const ok = EXTRACTABLE.test(name);
        return {
          kind: "material" as const,
          id: String(d.document_id),
          title: name,
          subtitle: truncate(clean(d.description), 140),
          meta: [d.category_name, d.file_size ? fmtSize(Number(d.file_size)) : "", [d.first_name, d.last_name].filter(Boolean).join(" ")].filter(Boolean),
          supported: ok,
          reason: ok ? undefined : "Only PDF and DOCX can be read",
        };
      }),
    ),
    group("elearning", "E-learning content", async () => {
      const courses = await findElearningCourses(token, courseId, scope);
      const items: SourceItem[] = [];
      for (const c of courses.slice(0, 3)) {
        const tree = await fetchCourseTree(token, Number(c.course_id));
        for (const s of asArray(tree?.sections)) {
          for (const it of asArray(s.items)) {
            if (it.item_type !== "PAGE" && it.item_type !== "KNOWLEDGE_CHECK") continue;
            const text = elearningItemText(it);
            items.push({
              kind: "elearning_item",
              id: `${c.course_id}:${it.item_id}`,
              title: clean(it.title) || (it.item_type === "PAGE" ? "Page" : "Knowledge check"),
              subtitle: truncate(clean(s.title), 140),
              week: clean(s.week_number) || null,
              meta: [it.item_type === "PAGE" ? "page" : "knowledge check", it.is_published ? "published" : "draft"],
              chars_estimate: text.length,
              supported: text.length > 60,
              reason: text.length > 60 ? undefined : "No written content",
            });
          }
        }
      }
      return items;
    }),
  ]);

  return {
    scope: {
      subject_name: scope.subjectName,
      class_group_id: scope.classGroupId,
      academic_term_id: scope.academicTermId,
      class_groups: scope.classGroups,
    },
    groups,
  };
}

// ---------------------------------------------------------------- resolving

interface ResolvedPart extends GenerationSourcePart {
  text: string;
}

const KIND_ORDER: SourceKind[] = ["competency", "sow_entry", "lesson_plan", "lesson_note", "elearning_item", "material"];

export async function resolveCourseResources(
  req: Request,
  token: string,
  courseId: number,
  sources: { kind: string; id: string }[],
  opts: { classGroupId?: number; academicTermId?: number },
) {
  const scope = await resolveScope(req, token, courseId, opts);
  const want = (k: SourceKind) => [...new Set(sources.filter((s) => s.kind === k).map((s) => s.id))];
  const parts: ResolvedPart[] = [];
  const missing: { kind: string; id: string; reason: string }[] = [];
  const miss = (kind: string, id: string, reason: string) => missing.push({ kind, id, reason });

  // Curriculum outcomes
  const compIds = want("competency");
  if (compIds.length) {
    const all = await fetchCompetencies(token, courseId);
    for (const id of compIds) {
      const c = all.find((x) => String(x.competency_id) === id);
      if (!c) miss("competency", id, "Not part of this subject's curriculum");
      else parts.push({ kind: "competency", id, title: clean(c.title), chars: 0, text: competencyText(c) });
    }
  }

  // Scheme-of-work entries and lesson plans both validate against this subject's entries
  const entryIds = want("sow_entry");
  const planIds = want("lesson_plan");
  if (entryIds.length || planIds.length) {
    const entries = await fetchSowEntries(token, courseId, scope);
    const byId = new Map(entries.map((e) => [String(e.entry_id), e]));
    for (const id of entryIds) {
      const e = byId.get(id);
      if (!e) miss("sow_entry", id, "Not in this subject's scheme of work");
      else parts.push({ kind: "sow_entry", id, title: `Week ${clean(e.week_number) || "?"} · ${clean(e.topic)}`, chars: 0, text: sowEntryText(e) });
    }
    const plansByEntry = new Map<string, string[]>();
    for (const id of planIds) {
      const [entryId, planId] = id.split(":");
      if (!byId.has(entryId) || !planId) {
        miss("lesson_plan", id, "Not in this subject's scheme of work");
        continue;
      }
      plansByEntry.set(entryId, [...(plansByEntry.get(entryId) || []), planId]);
    }
    await mapLimit([...plansByEntry], 4, async ([entryId, ids]) => {
      const plans = await fetchLessonPlans(token, Number(entryId)).catch(() => []);
      for (const planId of ids) {
        const p = plans.find((x: any) => String(x.id) === planId);
        if (!p) miss("lesson_plan", `${entryId}:${planId}`, "Lesson plan not found");
        else
          parts.push({
            kind: "lesson_plan",
            id: `${entryId}:${planId}`,
            title: `Lesson plan · ${clean(p.big_question) || clean(byId.get(entryId)?.topic)}`,
            chars: 0,
            text: lessonPlanText(p),
          });
      }
    });
  }

  // Lesson notes (MIS only returns the caller's own)
  await mapLimit(want("lesson_note"), 4, async (id) => {
    try {
      const n = unwrap(await misGet(token, `/lesson-notes/${encodeURIComponent(id)}`));
      if (!n || Number(n.subject_id) !== courseId) return miss("lesson_note", id, "Not a note for this subject");
      const text = htmlToText(n.content_html || "") || tiptapToText(n.content_json);
      if (!text) return miss("lesson_note", id, "The note has no readable text (scanned PDF?)");
      parts.push({ kind: "lesson_note", id, title: clean(n.title), chars: 0, text: `LESSON NOTE: ${clean(n.title)}\n${text}` });
    } catch (err: any) {
      if (err?.response?.status === 401) throw err;
      miss("lesson_note", id, err?.response?.status === 403 || err?.response?.status === 404 ? "Not available to you" : "Couldn't load it");
    }
  });

  // Shared materials: download and extract
  const docIds = want("material");
  if (docIds.length) {
    const docs = await fetchDocuments(token, courseId);
    await mapLimit(docIds, 3, async (id) => {
      const d = docs.find((x) => String(x.document_id) === id);
      if (!d) return miss("material", id, "Not one of this subject's materials");
      const name = String(d.original_name || d.file_name || "document");
      if (!EXTRACTABLE.test(name)) return miss("material", id, "Only PDF and DOCX can be read");
      try {
        const res = await axios.get(`${base()}/curriculum/documents/${encodeURIComponent(id)}/download`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "arraybuffer",
          timeout: 45_000,
          maxContentLength: 25 * 1024 * 1024,
        });
        const { text } = await DocumentExtractorService.extractText(Buffer.from(res.data), d.mime_type || "", name);
        if (clean(text).length < 50) return miss("material", id, "No readable text (scanned document?)");
        parts.push({ kind: "material", id, title: name, chars: 0, text: `MATERIAL: ${name}\n${text}` });
      } catch (err: any) {
        if (err?.response?.status === 401) throw err;
        miss("material", id, "Couldn't download or read the file");
      }
    });
  }

  // E-learning pages and knowledge checks
  const itemIds = want("elearning_item");
  if (itemIds.length) {
    const allowed = new Set((await findElearningCourses(token, courseId, scope)).map((c) => String(c.course_id)));
    const byCourse = new Map<string, string[]>();
    for (const id of itemIds) {
      const [cid, iid] = id.split(":");
      if (!allowed.has(cid) || !iid) miss("elearning_item", id, "Not part of this subject's e-learning course");
      else byCourse.set(cid, [...(byCourse.get(cid) || []), iid]);
    }
    for (const [cid, iids] of byCourse) {
      const tree = await fetchCourseTree(token, Number(cid));
      const items = asArray(tree?.sections).flatMap((s: any) => asArray(s.items));
      for (const iid of iids) {
        const it = items.find((x: any) => String(x.item_id) === iid);
        if (!it || (it.item_type !== "PAGE" && it.item_type !== "KNOWLEDGE_CHECK")) miss("elearning_item", `${cid}:${iid}`, "Item not found");
        else parts.push({ kind: "elearning_item", id: `${cid}:${iid}`, title: clean(it.title), chars: 0, text: elearningItemText(it) });
      }
    }
  }

  // Stable reading order (curriculum → weeks → plans → notes → e-learning → files),
  // then share the character budget so one long PDF can't crowd everything else out.
  parts.sort((a, b) => KIND_ORDER.indexOf(a.kind as SourceKind) - KIND_ORDER.indexOf(b.kind as SourceKind));
  const { text, truncated } = packParts(parts);

  return {
    text,
    truncated,
    label: describeSelection(parts, scope.subjectName),
    parts: parts.map(({ text: _t, ...p }) => p),
    missing,
  };
}

/**
 * Fit parts into MAX_TOTAL_CHARS: short parts keep everything, the leftover is
 * shared evenly among the long ones (water-filling), never below MIN_PART_CHARS.
 */
export function packParts(parts: { text: string; chars: number }[], max = MAX_TOTAL_CHARS) {
  const sep = "\n\n=====\n\n";
  const budget = Math.max(0, max - sep.length * Math.max(0, parts.length - 1));
  const lengths = parts.map((p) => p.text.length);
  const total = lengths.reduce((a, b) => a + b, 0);
  let caps = lengths.slice();
  if (total > budget) {
    let remaining = budget;
    const open = new Set(parts.map((_, i) => i));
    caps = new Array(parts.length).fill(0);
    while (open.size) {
      const share = Math.floor(remaining / open.size);
      const small = [...open].filter((i) => lengths[i] <= share);
      if (!small.length) {
        for (const i of open) caps[i] = Math.max(Math.min(MIN_PART_CHARS, lengths[i]), share);
        break;
      }
      for (const i of small) {
        caps[i] = lengths[i];
        remaining -= lengths[i];
        open.delete(i);
      }
    }
  }
  let truncated = false;
  const chunks = parts.map((p, i) => {
    const t = p.text.length > caps[i] ? `${p.text.slice(0, caps[i])}…` : p.text;
    if (t.length < p.text.length) truncated = true;
    p.chars = Math.min(p.text.length, caps[i]);
    return t;
  });
  let text = chunks.join(sep);
  if (text.length > max) {
    text = text.slice(0, max);
    truncated = true;
  }
  return { text, truncated };
}

function describeSelection(parts: GenerationSourcePart[], subjectName: string | null) {
  const names: Record<string, [string, string]> = {
    competency: ["learning outcome", "learning outcomes"],
    sow_entry: ["scheme-of-work topic", "scheme-of-work topics"],
    lesson_plan: ["lesson plan", "lesson plans"],
    lesson_note: ["lesson note", "lesson notes"],
    material: ["material", "materials"],
    elearning_item: ["e-learning item", "e-learning items"],
  };
  const counts = new Map<string, number>();
  for (const p of parts) counts.set(p.kind, (counts.get(p.kind) || 0) + 1);
  const bits = [...counts].map(([k, n]) => `${n} ${names[k]?.[n === 1 ? 0 : 1] ?? k}`);
  return `${subjectName ? `${subjectName}: ` : ""}${bits.join(", ")}`;
}
