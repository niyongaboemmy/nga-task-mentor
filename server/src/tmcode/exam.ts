import zlib from "zlib";
import { QuizQuestion, TmcodeSnapshot } from "../models";
import { getQuestionBankInclude } from "../utils/quizUtils";
import { SUBMIT_GRACE_SECONDS } from "../utils/quizTiming";
import { TmcodeProfile, profileById, profileIdForLanguage } from "./profiles";
import { Policy } from "./policy";
import { SnapshotFile } from "./journal";

/** Questions TMCode delivers: the code ones. */
export const TMCODE_QUESTION_TYPES = ["coding", "algorithmic"];

/** Without an overall duration or a closing date, an attempt runs this long. */
const FALLBACK_ATTEMPT_HOURS = 12;

const parseJson = (v: any) => {
  if (typeof v !== "string") return v ?? {};
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
};

/**
 * The attempt's deadline: its end_time (overall duration), else the quiz's
 * closing date, else start + 12 h (a per-question-timed quiz has no single
 * deadline; TMCode needs one).
 */
export function attemptDeadline(submission: any, quiz: any): Date {
  if (submission?.end_time) return new Date(submission.end_time);
  if (quiz?.end_date) return new Date(quiz.end_date);
  const start = submission?.started_at ? new Date(submission.started_at).getTime() : Date.now();
  return new Date(start + FALLBACK_ATTEMPT_HOURS * 3600_000);
}

/** Token lifetime: deadline + submit grace + offline grace (PROTOCOL.md §1). */
export const tokenExpiry = (deadline: Date, policy: Policy) =>
  new Date(
    deadline.getTime() + SUBMIT_GRACE_SECONDS * 1000 + policy.allow_offline_grace_minutes * 60_000,
  );

export async function codeQuestionsOf(quizId: number): Promise<QuizQuestion[]> {
  const all = await QuizQuestion.findAll({
    where: { quiz_id: quizId },
    include: getQuestionBankInclude(),
    order: [["order", "ASC"]],
  });
  return all.filter((q) => TMCODE_QUESTION_TYPES.includes(q.questionBank?.question_type as string));
}

export const questionData = (q: any) => parseJson(q?.questionBank?.question_data);

/** The TMCode profile a question is answered in (PROTOCOL.md §2 mapping). */
export function profileForQuestion(q: any): TmcodeProfile | null {
  const qd = questionData(q);
  const lang =
    qd.language ||
    (Array.isArray(qd.allowed_languages) ? qd.allowed_languages[0] : null) ||
    (q?.questionBank?.question_type === "algorithmic" ? "python" : null);
  const id = profileIdForLanguage(lang);
  return id ? profileById(id) ?? null : null;
}

/** The Task Mentor language key a profile's answers are graded in. */
export function languageForProfile(profileId: string): string {
  const map: Record<string, string> = {
    "python-3": "python",
    "node-22": "javascript",
    typescript: "typescript",
    c17: "c",
    cpp17: "cpp",
    "java-21": "java",
    web: "html",
    react: "react",
  };
  return map[profileId] ?? profileId;
}

export const gzipFiles = (files: SnapshotFile[]): Buffer =>
  zlib.gzipSync(Buffer.from(JSON.stringify(files), "utf8"));

export function gunzipFiles(buf: Buffer | null | undefined): SnapshotFile[] {
  if (!buf) return [];
  try {
    const parsed = JSON.parse(zlib.gunzipSync(buf).toString("utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The latest synced snapshot of a question in this attempt (any session). */
export const latestSnapshot = (submissionId: number, questionId: number) =>
  TmcodeSnapshot.findOne({
    where: { submission_id: submissionId, question_id: questionId },
    order: [
      ["server_ts", "DESC"],
      ["id", "DESC"],
    ],
  });

/** A question's starting workspace. */
export function starterFiles(q: any, profile: TmcodeProfile) {
  const qd = questionData(q);
  if (qd.project_mode && Array.isArray(qd.project_files) && qd.project_files.length) {
    return qd.project_files.map((f: any) => ({
      path: String(f.path ?? f.name),
      content: String(f.content ?? ""),
      readonly: f.readonly === true,
    }));
  }
  return [{ path: profile.entry_point, content: String(qd.starter_code ?? ""), readonly: false }];
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** One task of the exam package (no hidden tests, no answers). */
export async function buildTask(q: any, submissionId: number, profile: TmcodeProfile) {
  const qd = questionData(q);
  const tests: any[] = Array.isArray(qd.test_cases) ? qd.test_cases : [];
  const text = String(q.questionBank?.question_text ?? "");
  const title = stripHtml(text).slice(0, 80) || `Task ${q.order}`;
  const brief = [text, qd.algorithm_description, qd.input_format && `**Input:** ${qd.input_format}`,
    qd.output_format && `**Output:** ${qd.output_format}`, qd.constraints && `**Constraints:** ${qd.constraints}`]
    .filter(Boolean)
    .join("\n\n");
  const snap = await latestSnapshot(submissionId, q.id);
  return {
    question_id: q.id,
    order: Number(q.order) || 0,
    points: Number(q.points) || 0,
    title,
    brief_md: brief,
    profile_id: profile.id,
    files: starterFiles(q, profile),
    visible_tests: tests
      .filter((tc) => !tc?.is_hidden)
      .map((tc, i) => ({
        id: String(tc.id ?? i + 1),
        ...(tc.name ? { name: String(tc.name) } : {}),
        input: String(tc.input ?? ""),
        expected_output: String(tc.expected_output ?? ""),
        points: Number(tc.points) || 0,
      })),
    hidden_test_count: tests.filter((tc) => tc?.is_hidden).length,
    resume: snap ? { snapshot_seq: snap.seq, files: gunzipFiles(snap.files_gz) } : null,
  };
}

/** Local tools the profiles need (what TMCode checks it has). */
export function toolchainsOf(profiles: TmcodeProfile[]): string[] {
  const tools = new Set<string>();
  for (const p of profiles) {
    for (const step of [...(p.local?.build ?? []), ...(p.local ? [p.local.run] : [])]) {
      if (step.tool !== "exe") tools.add(step.tool);
    }
  }
  return [...tools];
}

/** The answer a snapshot puts on the QuizAttempt: project-mode shape. */
export function answerFromFiles(files: SnapshotFile[], profile: TmcodeProfile | null) {
  const entry = profile?.entry_point;
  const list = files.map((f, i) => ({
    name: f.path,
    content: f.content,
    language: profile ? languageForProfile(profile.id) : undefined,
    is_entry_point: entry ? f.path === entry : i === 0,
  }));
  if (!list.some((f) => f.is_entry_point) && list[0]) list[0].is_entry_point = true;
  return {
    code: JSON.stringify(list),
    language: profile ? languageForProfile(profile.id) : "python",
  };
}
