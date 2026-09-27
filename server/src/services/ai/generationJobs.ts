import crypto from "crypto";

/**
 * Background runs of one AI generation batch, polled by the client. Kept in
 * memory for the same reason as generationContextStore (single pm2 fork,
 * cheap to redo): a restart just means the client is told to generate again.
 */
export interface GenerationJob {
  id: string;
  userId: number;
  courseId: number;
  state: "running" | "done";
  outcome?: { status: number; payload: Record<string, unknown> };
  createdAt: number;
  finishedAt?: number;
}

const JOB_TTL_MS = 15 * 60 * 1000;
const MAX_JOBS = 300;
const jobs = new Map<string, GenerationJob>();

function sweep(now = Date.now()) {
  for (const [id, j] of jobs) if (now - j.createdAt > JOB_TTL_MS) jobs.delete(id);
  while (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value as string);
}

export function createJob(
  userId: number,
  courseId: number,
  run: () => Promise<{ status: number; payload: Record<string, unknown> }>,
): GenerationJob {
  sweep();
  const job: GenerationJob = { id: crypto.randomUUID(), userId, courseId, state: "running", createdAt: Date.now() };
  jobs.set(job.id, job);
  run()
    .then((outcome) => {
      job.outcome = outcome;
    })
    .catch((err: any) => {
      job.outcome = { status: 500, payload: { success: false, message: err?.message || "AI generation failed." } };
    })
    .finally(() => {
      job.state = "done";
      job.finishedAt = Date.now();
    });
  return job;
}

/** Only the user who started it, for the same course. */
export function getJob(id: string, userId: number, courseId: number): GenerationJob | null {
  const job = jobs.get(id);
  if (!job || job.userId !== userId || job.courseId !== courseId) return null;
  return job;
}

export function clearJobsForTests() {
  jobs.clear();
}
