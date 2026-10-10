import { Request, Response } from "express";
import { Op, QueryTypes, fn, col } from "sequelize";
import { sequelize } from "../config/database";
import { QuizSubmission, TmcodeDevice, TmcodeFlag, TmcodeSession, TmcodeSnapshot } from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { loadActivity, teacherCanSeeActivity } from "../tmcode/projects/access";
import { userBrief, usersById } from "../tmcode/projects/serialize";
import { FLAG_EXPLANATIONS, flagExplanation } from "../tmcode/practical/gradeMeta";

/**
 * TMCode exam sessions as people see them (UX gap review E4, E10): the
 * teacher's live view of a quiz delivered in TMCode, and the student's own
 * session for the web quiz page. Read-only, from what the exam protocol
 * already stores (tmcode_sessions heartbeats, snapshots, devices, flags).
 */

/** No heartbeat for this long: the session shows as offline (TMCode beats every ~30 s). */
export const SESSION_STALE_S = 90;

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const plain = (html: string | null | undefined) =>
  String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type SessionStatus = "active" | "submitted" | "offline";

/** active: heartbeat within SESSION_STALE_S; submitted: the session or attempt ended; else offline. */
export function sessionStatus(
  s: { status: string; last_heartbeat?: Date | string | null },
  attemptStatus: string | null | undefined,
  now = Date.now(),
): SessionStatus {
  if (s.status === "ended" || (attemptStatus && attemptStatus !== "in_progress")) return "submitted";
  const beat = s.last_heartbeat ? new Date(s.last_heartbeat).getTime() : 0;
  if (s.status === "active" && now - beat <= SESSION_STALE_S * 1000) return "active";
  return "offline";
}

/** Latest snapshot time per session (what TMCode last saved to Task Mentor). */
async function lastSyncs(sessionIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!sessionIds.length) return out;
  const rows = (await TmcodeSnapshot.findAll({
    where: { session_id: { [Op.in]: sessionIds } },
    attributes: ["session_id", [fn("MAX", col("server_ts")), "last"]],
    group: ["session_id"],
    raw: true,
  })) as unknown as { session_id: string; last: Date | string }[];
  for (const r of rows) if (r.last) out.set(r.session_id, iso(r.last)!);
  return out;
}

async function questionTitles(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!ids.length) return out;
  const rows = await sequelize.query<{ id: number; question_text: string }>(
    `SELECT qq.id, qb.question_text FROM quiz_questions qq JOIN question_bank qb ON qb.id = qq.question_id WHERE qq.id IN (:ids)`,
    { replacements: { ids }, type: QueryTypes.SELECT },
  );
  for (const r of rows) out.set(Number(r.id), plain(r.question_text).slice(0, 120) || `Question ${r.id}`);
  return out;
}

// @desc    Live view of a quiz's TMCode sessions (teacher of the quiz): one
//          row per student (their newest session), with status, last sync,
//          current task, app version and flags explained in one line.
// @route   GET /api/tmcode/quizzes/:quizId/sessions
export const quizSessions = async (req: Request, res: Response) => {
  const quizId = Number(req.params.quizId);
  const activity = await loadActivity("quiz", quizId);
  if (!activity) return tmcodeError(res, 404, "NOT_FOUND", "Quiz not found.");
  if (!(await teacherCanSeeActivity(req, activity))) {
    return tmcodeError(res, 403, "FORBIDDEN", "This quiz isn't in your courses.");
  }
  const all = await TmcodeSession.findAll({ where: { quiz_id: quizId }, order: [["started_at", "DESC"]] });
  // Newest session per student (a relaunch supersedes the previous one).
  const latest = new Map<number, TmcodeSession>();
  for (const s of all) if (!latest.has(Number(s.user_id))) latest.set(Number(s.user_id), s);
  const sessions = [...latest.values()];

  const submissionIds = [...new Set(sessions.map((s) => Number(s.submission_id)))];
  const [subs, devices, flags, syncs, users] = await Promise.all([
    submissionIds.length ? QuizSubmission.findAll({ where: { id: { [Op.in]: submissionIds } }, attributes: ["id", "status", "completed_at"] }) : [],
    sessions.length ? TmcodeDevice.findAll({ where: { id: { [Op.in]: [...new Set(sessions.map((s) => s.device_id))] } } }) : [],
    submissionIds.length ? TmcodeFlag.findAll({ where: { submission_id: { [Op.in]: submissionIds } }, order: [["at", "ASC"]] }) : [],
    lastSyncs(sessions.map((s) => s.id)),
    usersById(sessions.map((s) => Number(s.user_id))),
  ]);
  const titles = await questionTitles([...new Set(sessions.map((s) => Number(s.current_question)).filter((n) => n > 0))]);
  const now = Date.now();

  const rows = sessions.map((s) => {
    const sub = subs.find((x) => x.id === Number(s.submission_id)) ?? null;
    const device = devices.find((d) => d.id === s.device_id) ?? null;
    const status = sessionStatus(s, sub?.status, now);
    const own = flags.filter((f) => Number(f.submission_id) === Number(s.submission_id));
    const list = own.map((f) => ({
      rule: f.rule,
      severity: f.severity,
      at: iso(f.at),
      question_id: f.question_id ?? null,
      explanation: flagExplanation(f.rule),
    }));
    if (status === "active" && s.focus === "out") {
      list.push({ rule: "focus_out", severity: "info" as any, at: iso(s.last_heartbeat), question_id: null, explanation: flagExplanation("focus_out") });
    }
    const q = Number(s.current_question) || null;
    return {
      student: userBrief(users.get(Number(s.user_id)), Number(s.user_id)),
      submission_id: Number(s.submission_id),
      session_id: s.id,
      status,
      mode: s.mode,
      started_at: iso(s.started_at),
      last_heartbeat: iso(s.last_heartbeat),
      last_sync: syncs.get(s.id) ?? null,
      submitted_at: status === "submitted" ? iso(sub?.completed_at ?? s.ended_at) : null,
      current_task: q ? { question_id: q, title: titles.get(q) ?? `Question ${q}` } : null,
      focus: s.focus ?? null,
      app_version: device?.app_version ?? null,
      os: device?.os ?? null,
      flags: list,
    };
  });
  const order: Record<SessionStatus, number> = { active: 0, offline: 1, submitted: 2 };
  rows.sort((a, b) => order[a.status] - order[b.status] || String(a.student?.name ?? "").localeCompare(String(b.student?.name ?? "")));
  return res.status(200).json({
    quiz: { id: activity.id, title: activity.title },
    generated_at: new Date(now).toISOString(),
    stale_after_s: SESSION_STALE_S,
    counts: {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      offline: rows.filter((r) => r.status === "offline").length,
      submitted: rows.filter((r) => r.status === "submitted").length,
      flagged: rows.filter((r) => r.flags.some((f) => f.rule !== "focus_out")).length,
    },
    sessions: rows,
    explanations: FLAG_EXPLANATIONS,
  });
};

// @desc    The caller's own TMCode session for their open attempt of a quiz,
//          so the web quiz page can warn before a web submit (E10).
//          `session: null` when the attempt isn't open in TMCode.
// @route   GET /api/tmcode/quizzes/:quizId/my-session
export const mySession = async (req: Request, res: Response) => {
  const quizId = Number(req.params.quizId);
  const userId = Number(req.user.id);
  const open = await QuizSubmission.findOne({
    where: { quiz_id: quizId, student_id: userId, status: "in_progress" },
    order: [["id", "DESC"]],
    attributes: ["id", "status"],
  });
  if (!open) return res.status(200).json({ session: null });
  const s = await TmcodeSession.findOne({
    where: { submission_id: open.id, user_id: userId, status: { [Op.in]: ["active", "ended"] } },
    order: [["started_at", "DESC"]],
  });
  if (!s) return res.status(200).json({ session: null });
  const [syncs, device] = await Promise.all([lastSyncs([s.id]), TmcodeDevice.findByPk(s.device_id)]);
  const status = sessionStatus(s, open.status);
  return res.status(200).json({
    session: {
      submission_id: open.id,
      status,
      active: status === "active",
      last_saved_at: syncs.get(s.id) ?? null,
      last_heartbeat: iso(s.last_heartbeat),
      app_version: device?.app_version ?? null,
    },
  });
};
