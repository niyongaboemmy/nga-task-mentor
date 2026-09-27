import crypto from "crypto";

/**
 * Source text prepared for AI question generation (an extracted upload or a set
 * of MIS course resources), held briefly so the client can run several
 * generation batches against it by id instead of re-sending up to 80k chars
 * each time (the global express.json() limit is 100 kB).
 *
 * In-memory on purpose: Task Mentor runs as one pm2 fork, the text is cheap to
 * rebuild, and a restart just means the client gets a 410 and prepares again.
 */
export interface GenerationSourcePart {
  kind: string;
  id: string;
  title: string;
  chars: number;
}

export interface GenerationContext {
  id: string;
  userId: number;
  courseId: number;
  text: string;
  label: string;
  origin: "document" | "resources";
  parts: GenerationSourcePart[];
  truncated: boolean;
  createdAt: number;
  expiresAt: number;
}

export const CONTEXT_TTL_MS = 45 * 60 * 1000;
const MAX_CONTEXTS = 200;
const store = new Map<string, GenerationContext>();

function sweep(now = Date.now()) {
  for (const [id, ctx] of store) if (ctx.expiresAt <= now) store.delete(id);
  // Oldest first (Map keeps insertion order) once over capacity.
  while (store.size > MAX_CONTEXTS) store.delete(store.keys().next().value as string);
}

export function saveContext(
  input: Omit<GenerationContext, "id" | "createdAt" | "expiresAt">,
): GenerationContext {
  sweep();
  const now = Date.now();
  const ctx: GenerationContext = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    expiresAt: now + CONTEXT_TTL_MS,
  };
  store.set(ctx.id, ctx);
  return ctx;
}

/** Only the user who prepared it, for the same course, gets it back. */
export function getContext(
  id: string,
  userId: number,
  courseId: number,
): GenerationContext | null {
  const ctx = store.get(id);
  if (!ctx) return null;
  if (ctx.expiresAt <= Date.now()) {
    store.delete(id);
    return null;
  }
  if (ctx.userId !== userId || ctx.courseId !== courseId) return null;
  // Sliding expiry: a teacher still working through batches keeps it alive.
  ctx.expiresAt = Date.now() + CONTEXT_TTL_MS;
  return ctx;
}

export function clearContextsForTests() {
  store.clear();
}
