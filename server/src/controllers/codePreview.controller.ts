import { Request, Response } from "express";
import { z } from "zod";
import { getPreview, openPreviewEvents, PreviewError, previewUrl, startPreview, stopPreview } from "../services/coderunner/previews";
import { relaySse } from "./sse";

/**
 * Running a student's web server and showing it (CODE_RUNNER_PLAN.md phase
 * 5). Task Mentor never serves the page itself: it hands out a short-lived
 * signed address on the separate preview origin.
 */

const fail = (res: Response, e: unknown) => {
  if (e instanceof PreviewError) return res.status(e.status).json({ success: false, code: e.code, message: e.message });
  console.error("Code preview error:", e);
  return res.status(500).json({ success: false, code: "PREVIEW_FAILED", message: "The server couldn't be started because of a problem on Task Mentor." });
};

const startSchema = z.object({
  language: z.string().max(40).optional().nullable(),
  kind: z.string().max(60).optional().nullable(),
  entry: z.string().max(500).optional().nullable(),
  files: z
    .array(z.object({ path: z.string().min(1).max(500), content: z.string() }))
    .min(1)
    .max(400),
});

// @desc    Start a web server from these files (one per person)
// @route   POST /api/code/previews
export const startCodePreview = async (req: Request, res: Response) => {
  const parsed = startSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid preview request." });
  const bytes = parsed.data.files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  if (bytes > 1.5 * 1024 * 1024) return res.status(413).json({ success: false, code: "TOO_LARGE", message: "The files are too large to run (1.5 MB at most)." });
  for (const f of parsed.data.files) {
    if (f.path.startsWith("/") || f.path.split("/").some((s) => s === ".." || s === "")) {
      return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: `Invalid file path: ${f.path}` });
    }
  }
  try {
    const p = await startPreview(Number(req.user.id), parsed.data);
    return res.status(201).json({ success: true, data: { id: p.id, url: previewUrl(p.runnerId) } });
  } catch (e) {
    return fail(res, e);
  }
};

// @desc    The server's build and log output, and when it is ready (SSE)
// @route   GET /api/code/previews/:id/events
export const codePreviewEvents = async (req: Request, res: Response) => {
  let p: ReturnType<typeof getPreview>;
  try {
    p = getPreview(String(req.params.id), Number(req.user.id));
  } catch (e) {
    return fail(res, e);
  }
  try {
    // Leaving the page stops the server. The stream ending doesn't: the
    // server may still be running (Stop, or its 15-minute limit, ends it).
    await relaySse(req, res, (signal) => openPreviewEvents(p, signal), () => void stopPreview(p));
  } catch (e) {
    if (!res.headersSent) return fail(res, e);
  }
};

// @desc    A fresh signed address for a running preview (they last 15 minutes)
// @route   GET /api/code/previews/:id/url
export const codePreviewUrl = async (req: Request, res: Response) => {
  try {
    const p = getPreview(String(req.params.id), Number(req.user.id));
    if (p.closed) throw new PreviewError(404, "PREVIEW_NOT_FOUND", "This server has stopped. Start it again.");
    return res.json({ success: true, data: { url: previewUrl(p.runnerId) } });
  } catch (e) {
    return fail(res, e);
  }
};

// @desc    Stop the server
// @route   DELETE /api/code/previews/:id
export const stopCodePreview = async (req: Request, res: Response) => {
  try {
    await stopPreview(getPreview(String(req.params.id), Number(req.user.id)));
    return res.status(204).end();
  } catch (e) {
    return fail(res, e);
  }
};
