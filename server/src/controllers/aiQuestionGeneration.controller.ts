import { Request, Response } from "express";
import { QuestionBank } from "../models";
import { QuestionValidator } from "../utils/questionValidation";
import { QuestionType } from "../types/quiz.types";
import { DocumentExtractorService } from "../services/DocumentExtractorService";
import { aiService } from "../services/ai/aiService";
import { planTotal } from "../services/ai/prompts/generateFromDocumentPrompt";
import {
  saveContext,
  getContext,
  GenerationContext,
  CONTEXT_TTL_MS,
} from "../services/ai/generationContextStore";
import {
  listCourseResources,
  resolveCourseResources,
  MisResourceError,
} from "../services/ai/misCourseResources";
import { getMisToken, handleMisError } from "../utils/misUtils";
import { createJob, getJob } from "../services/ai/generationJobs";
import { sendControllerError } from "../utils/controllerErrors";
import type {
  AIGenerateBatchBody,
  AIResolveSourcesBody,
} from "../validations/aiGeneration.validation";

// The AI Question Generator works in two steps:
//   1. prepare — turn an uploaded document, or a set of MIS course resources, into
//      source text; the client gets a context_id plus a preview of what the AI reads.
//   2. generate — run one batch (≤12 questions, type × difficulty plan) against it.
// Nothing is saved here; the teacher reviews and saves through POST /bulk.

const courseIdOf = (req: Request) => Number(req.params.courseId);

function contextSummary(ctx: GenerationContext) {
  return {
    context_id: ctx.id,
    origin: ctx.origin,
    label: ctx.label,
    char_count: ctx.text.length,
    truncated: ctx.truncated,
    parts: ctx.parts,
    // Enough for the teacher to sanity-check what the AI will read.
    preview: ctx.text.slice(0, 1500),
    expires_in_seconds: Math.round(CONTEXT_TTL_MS / 1000),
  };
}

const normalizeText = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// @desc    AI providers the generator can use, in fallback order
// @route   GET /api/courses/:courseId/question-bank/ai/providers
export const getAIProviders = async (_req: Request, res: Response) => {
  const providers = aiService.describeProviders();
  res.json({
    success: true,
    data: {
      providers,
      any_available: providers.some((p) => p.configured && !p.cooling_down),
    },
  });
};

// @desc    Extract an uploaded PDF/DOCX into a generation context
// @route   POST /api/courses/:courseId/question-bank/ai/prepare/document
export const prepareDocumentContext = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Upload a PDF or DOCX document (max 20 MB).",
      });
    }
    const { text, truncated } = await DocumentExtractorService.extractText(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );
    if (!text || text.trim().length < 50) {
      return res.status(422).json({
        success: false,
        message:
          "Could not extract meaningful text from the document. Check it is not empty, scanned-only, or password-protected.",
      });
    }
    const ctx = saveContext({
      userId: req.user!.id,
      courseId: courseIdOf(req),
      text,
      label: req.file.originalname,
      origin: "document",
      parts: [{ kind: "document", id: req.file.originalname, title: req.file.originalname, chars: text.length }],
      truncated,
    });
    res.json({ success: true, data: contextSummary(ctx) });
  } catch (error: any) {
    if (/Unsupported file type/.test(error?.message || "")) {
      return res.status(415).json({ success: false, message: error.message });
    }
    return sendControllerError(res, error, "AI prepare document");
  }
};

// @desc    Course resources (scheme of work, lesson plans, materials, e-learning) to generate from
// @route   GET /api/courses/:courseId/question-bank/ai/sources
export const getAISources = async (req: Request, res: Response) => {
  const token = getMisToken(req, { quiet: true });
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required (MIS)" });
  }
  try {
    const data = await listCourseResources(req, token, courseIdOf(req), {
      classGroupId: req.query.class_group_id ? Number(req.query.class_group_id) : undefined,
      academicTermId: req.query.academic_term_id ? Number(req.query.academic_term_id) : undefined,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof MisResourceError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return handleMisError(error, res, "Could not load course resources from the MIS");
  }
};

// @desc    Pull the chosen resources' text from the MIS into a generation context
// @route   POST /api/courses/:courseId/question-bank/ai/prepare/resources
export const prepareResourcesContext = async (req: Request, res: Response) => {
  const token = getMisToken(req, { quiet: true });
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required (MIS)" });
  }
  const body = req.body as AIResolveSourcesBody;
  try {
    const resolved = await resolveCourseResources(req, token, courseIdOf(req), body.sources, {
      classGroupId: body.class_group_id,
      academicTermId: body.academic_term_id,
    });
    if (resolved.text.trim().length < 50) {
      return res.status(422).json({
        success: false,
        message:
          "The selected resources don't have enough written content for the AI to work from. Add more resources, or upload a document instead.",
        data: { parts: resolved.parts, missing: resolved.missing },
      });
    }
    const ctx = saveContext({
      userId: req.user!.id,
      courseId: courseIdOf(req),
      text: resolved.text,
      label: resolved.label,
      origin: "resources",
      parts: resolved.parts,
      truncated: resolved.truncated,
    });
    res.json({ success: true, data: { ...contextSummary(ctx), missing: resolved.missing } });
  } catch (error: any) {
    if (error instanceof MisResourceError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return handleMisError(error, res, "Could not load the selected resources from the MIS");
  }
};

// @desc    Generate one batch of questions from a prepared context (preview only)
// @route   POST /api/courses/:courseId/question-bank/ai/generate
type BatchOutcome = { status: number; payload: Record<string, unknown> };

async function runBatch(userId: number, courseId: number, body: AIGenerateBatchBody): Promise<BatchOutcome> {
  const ctx = getContext(body.context_id, userId, courseId);
  if (!ctx) {
    return {
      status: 410,
      payload: {
        success: false,
        code: "CONTEXT_EXPIRED",
        message: "The prepared source expired. Preparing it again…",
      },
    };
  }

  const plan = body.plan.filter((p) => p.EASY + p.MEDIUM + p.DIFFICULT > 0);
  const requested = planTotal(plan);
  const startedAt = Date.now();

  try {
    // Steer away from what's already in this subject's bank (latest first).
    const existing = await QuestionBank.findAll({
      where: { course_id: courseId },
      attributes: ["question_text"],
      order: [["id", "DESC"]],
      limit: 40,
      raw: true,
    });
    const existingTexts = existing.map((q: any) => String(q.question_text || ""));
    // The prompt lists at most 40: this run's newest questions first (the likeliest
    // repeats), then the bank's latest. Duplicate filtering below still uses all.
    const fromRun = body.avoid_questions.slice(-25).reverse();
    const avoid = [...fromRun, ...existingTexts.slice(0, Math.max(15, 40 - fromRun.length))];

    const { questions, providerUsed } = await aiService.generateQuestionsFromSource(
      {
        sourceText: ctx.text,
        sourceLabel: ctx.label,
        plan,
        additionalContext: body.additional_context,
        avoidQuestions: avoid,
      },
      { provider: body.provider },
    );

    const allowedTypes = new Set(plan.map((p) => p.question_type));
    const seen = new Set(avoid.map(normalizeText));
    const valid: typeof questions = [];
    const skipped: { question_type: string; reason: string }[] = [];

    for (const q of questions) {
      if (!allowedTypes.has(q.question_type)) {
        skipped.push({ question_type: q.question_type, reason: "Type was not requested" });
        continue;
      }
      const validation = QuestionValidator.validateQuestionData(
        q.question_type as QuestionType,
        q.question_data,
      );
      if (!validation.isValid) {
        skipped.push({
          question_type: q.question_type,
          reason: validation.errors?.[0] || "Failed structural validation",
        });
        continue;
      }
      const key = normalizeText(q.question_text);
      if (seen.has(key)) {
        skipped.push({ question_type: q.question_type, reason: "Duplicate of an existing question" });
        continue;
      }
      seen.add(key);
      valid.push(q);
    }

    // Trim any over-delivery so the batch honours the plan cell by cell.
    const remaining = new Map(plan.map((p) => [p.question_type, { ...p } as Record<string, any>]));
    const kept = valid.filter((q) => {
      const cell = remaining.get(q.question_type)!;
      if (cell[q.difficulty_level] > 0) {
        cell[q.difficulty_level]--;
        return true;
      }
      // Wrong difficulty but that type still has room at another level: keep it, it's honest data.
      const other = (["EASY", "MEDIUM", "DIFFICULT"] as const).find((d) => cell[d] > 0);
      if (other) {
        cell[other]--;
        return true;
      }
      skipped.push({ question_type: q.question_type, reason: "More than requested" });
      return false;
    });

    return {
      status: 200,
      payload: {
      success: true,
      data: kept,
      meta: {
        requested,
        returned: kept.length,
        skipped,
        provider_used: providerUsed,
        provider_requested: body.provider,
        fell_back: !!body.provider && body.provider !== providerUsed,
        duration_ms: Date.now() - startedAt,
        context_id: ctx.id,
      },
      },
    };
  } catch (error: any) {
    console.error("[AI Generate batch] Error:", error?.message);
    const msg = String(error?.message || "");
    const status = /not configured/i.test(msg) ? 503 : /rate-limited/i.test(msg) ? 429 : 502;
    return {
      status,
      payload: { success: false, message: msg || "AI generation failed. Please try again." },
    };
  }
}

// @route   POST /api/courses/:courseId/question-bank/ai/generate
// With `async: true` the batch runs as a background job and the reply is a
// 202 with job_id, polled via GET /ai/jobs/:jobId. A provider fallback chain can
// take longer than the reverse proxy's 60 s read timeout; holding the request
// open made the browser report a bare "Network Error" and lost the result.
export const generateQuestionBatch = async (req: Request, res: Response) => {
  const body = req.body as AIGenerateBatchBody;
  const userId = req.user!.id;
  const courseId = courseIdOf(req);
  if (!body.async) {
    const { status, payload } = await runBatch(userId, courseId, body);
    return res.status(status).json(payload);
  }
  const job = createJob(userId, courseId, () => runBatch(userId, courseId, body));
  res.status(202).json({ success: true, job_id: job.id, poll_after_ms: 2000 });
};

// @desc    Status / result of an async generation batch
// @route   GET /api/courses/:courseId/question-bank/ai/jobs/:jobId
export const getGenerationJob = async (req: Request, res: Response) => {
  const job = getJob(String(req.params.jobId), req.user!.id, courseIdOf(req));
  if (!job) {
    return res.status(404).json({
      success: false,
      code: "JOB_NOT_FOUND",
      message: "This generation run is no longer available (the server may have restarted). Please generate again.",
    });
  }
  if (job.state === "running") {
    return res.json({ success: true, state: "running", elapsed_ms: Date.now() - job.createdAt });
  }
  res.status(job.outcome!.status).json({ ...job.outcome!.payload, state: "done" });
};
